import * as core from "@actions/core";
import { exec } from "@actions/exec";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { PassThrough, Transform } from "node:stream";
import path from "node:path";
import { fileURLToPath } from "node:url";
//#region src/action.ts
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
async function run({ token, secret, appID, alias, force = false, cleverCLI, timeout, deployPath, logFile, quiet = false, extraEnv = {}, sameCommitPolicy }) {
	try {
		await checkForShallowCopy();
		const execOptions = { outStream: await getOutputStream(quiet, logFile) };
		if (deployPath) try {
			await fs.access(deployPath);
			execOptions.cwd = deployPath;
			core.info(`Deploying from directory: ${deployPath}`);
		} catch (error) {
			throw new Error(`Deploy path does not exist: ${deployPath}`);
		}
		core.debug(`Clever CLI path: ${cleverCLI}`);
		await exec(cleverCLI, [
			"login",
			"--token",
			token,
			"--secret",
			secret
		]);
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
			core.info(`Setting environment variable ${envName}`);
			await exec(cleverCLI, args, execOptions);
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
				exited.catch(() => {});
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
async function getOutputStream(quiet, logFile) {
	const tee = new PassThrough();
	if (!quiet) {
		let lineSeparator = "\n";
		async function* splitNewlines(input) {
			for await (const chunk of input) {
				const str = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : chunk;
				if (str.includes("\r\n")) lineSeparator = "\r\n";
				const lines = str.split(/\r?\n/);
				for (const line of lines) yield line;
			}
		}
		async function* injectAnnotations(lines) {
			for await (const line of lines) {
				yield line + lineSeparator;
				const message = line.slice(26);
				if (message.startsWith("::notice ") || message.startsWith("::error ") || message.startsWith("::warning ")) yield message + lineSeparator;
			}
		}
		tee.pipe(Transform.from(splitNewlines)).pipe(Transform.from(injectAnnotations)).pipe(process.stdout);
	}
	if (logFile) {
		const logFileStream = (await fs.open(logFile, "w")).createWriteStream();
		tee.pipe(logFileStream);
	}
	return tee;
}
//#endregion
//#region src/arguments.ts
const __dirname = path.dirname(fileURLToPath(import.meta.url));
function throwMissingEnvVar(name) {
	throw new Error(`Missing ${name} environment variable: https://err.sh/47ng/actions-clever-cloud/env`);
}
const ENV_LINE_REGEX = /^(\w+)=(.*)$/;
function listExtraEnv() {
	const extraEnv = core.getMultilineInput("setEnv").map((line) => line.trim()).reduce((env, line) => {
		const match = line.match(ENV_LINE_REGEX);
		if (!match) return env;
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
	const timeout = parseInt(core.getInput("timeout")) || void 0;
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