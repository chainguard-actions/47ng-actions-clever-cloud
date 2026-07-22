import * as core from "@actions/core";
import { exec } from "@actions/exec";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { PassThrough, Transform } from "node:stream";
import { finished } from "node:stream/promises";
import { StringDecoder } from "node:string_decoder";
import path from "node:path";
import { fileURLToPath } from "node:url";
//#region src/action.ts
const DEPLOY_TERMINATION_GRACE_PERIOD_MS = 5e3;
const DEPLOY_FORCE_KILL_WAIT_MS = 5e3;
async function checkForShallowCopy() {
	let output = "";
	await exec("git", ["rev-parse", "--is-shallow-repository"], { listeners: { stdout: (data) => output += data.toString() } });
	if (output.trim() === "true") throw new Error(`This action requires an unshallow working copy.
-> Use the following step before running this action:
 - uses: actions/checkout@v3
   with:
     fetch-depth: 0
`);
}
async function run({ appID, alias, force = false, cleverCLI, timeout, deployPath, logFile, quiet = false, extraEnv = {}, sameCommitPolicy }) {
	let outputStream;
	try {
		await checkForShallowCopy();
		outputStream = await getOutputStream(quiet, logFile);
		const execOptions = { outStream: outputStream.stream };
		if (deployPath) try {
			await fs.access(deployPath);
			execOptions.cwd = deployPath;
			core.info(`Running Clever CLI from directory: ${deployPath}`);
		} catch (error) {
			throw new Error(`Deploy path does not exist: ${deployPath}`);
		}
		core.debug(`Clever CLI path: ${cleverCLI}`);
		if (appID) {
			core.debug(`Linking ${appID}`);
			await exec(cleverCLI, [
				"link",
				appID,
				"--alias",
				appID
			], execOptions);
			alias = appID;
		}
		for (const [envName, envValue] of Object.entries(extraEnv)) {
			const args = ["env", "set"];
			if (alias) args.push("--alias", alias);
			args.push(envName, envValue);
			if (envValue) core.setSecret(envValue);
			core.info(`Setting environment variable ${envName}`);
			let stderr = "";
			const code = await exec(cleverCLI, args, {
				...execOptions,
				silent: true,
				ignoreReturnCode: true,
				listeners: { stderr: (data) => stderr += data.toString() }
			});
			if (code !== 0) throw new Error(`Failed to set environment variable ${envName} (exit code ${code}): ${stderr.trim()}`);
		}
		const args = ["deploy"];
		if (appID) args.push("--alias", appID);
		else if (alias) args.push("--alias", alias);
		if (force) args.push("--force");
		if (sameCommitPolicy) args.push("--same-commit-policy", sameCommitPolicy);
		if (timeout) {
			const { child, exited } = spawnDeploy(cleverCLI, args, execOptions);
			let timeoutID;
			let timedOut = false;
			const timeoutPromise = new Promise((resolve) => {
				timeoutID = setTimeout(() => {
					timedOut = true;
					resolve();
				}, timeout * 1e3);
			});
			let result;
			try {
				result = await Promise.race([exited, timeoutPromise]);
			} finally {
				if (timeoutID) clearTimeout(timeoutID);
			}
			if (timedOut) {
				child.kill("SIGTERM");
				let forceKillTimeoutID;
				const forceKillPromise = new Promise((resolve) => {
					forceKillTimeoutID = setTimeout(() => {
						child.kill("SIGKILL");
						resolve();
					}, DEPLOY_TERMINATION_GRACE_PERIOD_MS);
				});
				const settledExit = exited.then(() => void 0, () => void 0);
				const forced = await Promise.race([settledExit.then(() => false), forceKillPromise.then(() => true)]);
				if (forceKillTimeoutID) clearTimeout(forceKillTimeoutID);
				if (forced) {
					let forceKillWaitTimeoutID;
					const forceKillWaitPromise = new Promise((resolve) => {
						forceKillWaitTimeoutID = setTimeout(() => resolve(false), DEPLOY_FORCE_KILL_WAIT_MS);
					});
					const exitedAfterForceKill = await Promise.race([settledExit.then(() => true), forceKillWaitPromise]);
					if (forceKillWaitTimeoutID) clearTimeout(forceKillWaitTimeoutID);
					if (!exitedAfterForceKill) {
						if (execOptions.outStream) {
							child.stdout.unpipe(execOptions.outStream);
							child.stderr.unpipe(execOptions.outStream);
						}
						child.stdout.destroy();
						child.stderr.destroy();
						child.unref();
					}
				}
				core.info("Deployment timed out, moving on with workflow run");
				return;
			}
			core.info(`result: ${result}`);
			if (typeof result === "number" && result !== 0) throw new Error(`Deployment failed with code ${result}`);
		} else {
			const code = await exec(cleverCLI, args, execOptions);
			core.info(`code: ${code}`);
			if (code !== 0) throw new Error(`Deployment failed with code ${code}`);
		}
	} catch (error) {
		if (error instanceof Error) core.setFailed(error.message);
		else core.setFailed(String(error));
	} finally {
		if (outputStream) {
			outputStream.stream.end();
			await outputStream.done();
		}
	}
}
/**
* Spawn the Clever CLI deploy ourselves so we keep a handle on the child
* process and can terminate it when the deployment timeout fires.
*
* Output is piped into the same tee stream used by @actions/exec (via
* `options.outStream`) so console logging, log files and annotation injection
* keep working identically to the non-timeout path.
*/
function spawnDeploy(cleverCLI, args, options) {
	const child = spawn(cleverCLI, args, {
		cwd: options.cwd,
		stdio: [
			"ignore",
			"pipe",
			"pipe"
		]
	});
	if (options.outStream) {
		child.stdout.pipe(options.outStream, { end: false });
		child.stderr.pipe(options.outStream, { end: false });
	}
	return {
		child,
		exited: new Promise((resolve, reject) => {
			child.once("error", reject);
			child.once("close", (code) => resolve(code ?? 0));
		})
	};
}
const TIMESTAMP_PREFIX_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[+-]\d{2}:\d{2}|Z):? /;
async function getOutputStream(quiet, logFile) {
	const tee = new PassThrough();
	const completions = [];
	const completionErrors = [];
	let liveSinkCount = 0;
	const monitor = (completion) => {
		liveSinkCount += 1;
		completions.push(completion.catch((error) => {
			completionErrors.push(error);
			liveSinkCount -= 1;
			if (liveSinkCount === 0) tee.resume();
		}));
	};
	if (!quiet) {
		let lineSeparator = "\n";
		async function* splitNewlines(input) {
			let carry = "";
			const decoder = new StringDecoder("utf8");
			for await (const chunk of input) {
				const str = carry + decoder.write(chunk);
				if (str.includes("\r\n")) lineSeparator = "\r\n";
				const lines = str.split(/\r?\n/);
				carry = lines.pop() ?? "";
				for (const line of lines) yield line;
			}
			carry += decoder.end();
			if (carry.length > 0) yield carry;
		}
		async function* injectAnnotations(lines) {
			for await (const line of lines) {
				yield line + lineSeparator;
				const message = line.replace(TIMESTAMP_PREFIX_REGEX, "");
				if (message !== line && (message.startsWith("::notice ") || message.startsWith("::error ") || message.startsWith("::warning "))) yield message + lineSeparator;
			}
		}
		const lastTransform = tee.pipe(Transform.from(splitNewlines)).pipe(Transform.from(injectAnnotations));
		lastTransform.pipe(process.stdout, { end: false });
		monitor(finished(lastTransform));
	}
	if (logFile) {
		const logFileStream = (await fs.open(logFile, "w")).createWriteStream();
		tee.pipe(logFileStream);
		monitor(finished(logFileStream));
	}
	if (liveSinkCount === 0) tee.resume();
	const done = async () => {
		await Promise.all(completions);
		if (completionErrors.length > 0) {
			const error = completionErrors[0];
			core.warning(`deploy log output degraded: ${error instanceof Error ? error.message : String(error)}`);
		}
	};
	return {
		stream: tee,
		done
	};
}
//#endregion
//#region src/arguments.ts
const __dirname = path.dirname(fileURLToPath(import.meta.url));
function throwMissingEnvVar(name) {
	throw new Error(`Missing ${name} environment variable: https://err.sh/47ng/actions-clever-cloud/env`);
}
const ENV_LINE_REGEX = /^(\w+)=(.*)$/;
const TIMEOUT_INPUT_REGEX = /^\d+$/;
const MAX_TIMEOUT_SECONDS = 1440 * 60;
function invalidTimeoutError(input) {
	return /* @__PURE__ */ new Error(`Invalid timeout value: ${input} (expected an integer number of seconds between 1 and ${MAX_TIMEOUT_SECONDS}, or 0 to disable)`);
}
function redactValue(line) {
	const equalsIndex = line.indexOf("=");
	if (equalsIndex === -1) return `(content hidden, no '=' found)`;
	return `${line.slice(0, equalsIndex)}=***`;
}
function listExtraEnv() {
	const extraEnv = core.getMultilineInput("setEnv").map((line) => line.trim()).reduce((env, line) => {
		if (line === "") return env;
		const match = line.match(ENV_LINE_REGEX);
		if (!match) {
			if (!line.startsWith("#")) core.warning(`Ignoring setEnv line that is not KEY=value (keys are [A-Za-z0-9_]): ${redactValue(line)}`);
			return env;
		}
		const key = match[1];
		env[key] = match[2];
		return env;
	}, {});
	if (Object.keys(extraEnv).length) {
		core.info("Setting extra environment variables:");
		for (const envName in extraEnv) core.info(`  ${envName}`);
	}
	return extraEnv;
}
function processArguments() {
	const token = process.env.CLEVER_TOKEN;
	const secret = process.env.CLEVER_SECRET;
	if (!token) throwMissingEnvVar("CLEVER_TOKEN");
	if (!secret) throwMissingEnvVar("CLEVER_SECRET");
	const appID = core.getInput("appID");
	const alias = core.getInput("alias");
	const force = core.getBooleanInput("force", { required: false });
	const timeoutInput = core.getInput("timeout");
	let timeout = void 0;
	if (timeoutInput) {
		if (!TIMEOUT_INPUT_REGEX.test(timeoutInput.trim())) throw invalidTimeoutError(timeoutInput);
		const parsed = Number(timeoutInput);
		if (parsed === 0) timeout = void 0;
		else if (!Number.isSafeInteger(parsed) || parsed > MAX_TIMEOUT_SECONDS) throw invalidTimeoutError(timeoutInput);
		else timeout = parsed;
	}
	const logFile = core.getInput("logFile") || void 0;
	const quiet = core.getBooleanInput("quiet", { required: false });
	const deployPath = core.getInput("deployPath") || void 0;
	const sameCommitPolicy = core.getInput("sameCommitPolicy") || void 0;
	return {
		token,
		secret,
		alias,
		force,
		appID,
		timeout,
		deployPath,
		cleverCLI: path.resolve(__dirname, "../node_modules/.bin/clever"),
		extraEnv: listExtraEnv(),
		logFile,
		quiet,
		sameCommitPolicy
	};
}
//#endregion
//#region src/main.ts
async function main() {
	try {
		await fixGitDubiousOwnership();
		return await run(processArguments());
	} catch (error) {
		if (error instanceof Error) core.setFailed(error.message);
		else core.setFailed(String(error));
	}
}
function fixGitDubiousOwnership() {
	return exec("git", [
		"config",
		"--global",
		"--add",
		"safe.directory",
		"/github/workspace"
	]);
}
if (import.meta.main) main();
//#endregion
export {};

//# sourceMappingURL=main.js.map