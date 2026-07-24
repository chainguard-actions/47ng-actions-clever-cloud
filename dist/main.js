import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import * as core from "@actions/core";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import { PassThrough } from "node:stream";
import { finished, pipeline } from "node:stream/promises";
import { StringDecoder } from "node:string_decoder";
//#region src/process.ts
function startProcess(command, args, options = {}) {
	const child = spawn(command, args, {
		cwd: options.cwd,
		stdio: [
			"ignore",
			"pipe",
			"pipe"
		]
	});
	const { outStream } = options;
	if (outStream) {
		child.stdout.pipe(outStream, { end: false });
		child.stderr.pipe(outStream, { end: false });
	}
	let stdout = "";
	let stderr = "";
	if (options.captureStdout) child.stdout.on("data", (data) => stdout += data.toString());
	if (options.captureStderr) child.stderr.on("data", (data) => stderr += data.toString());
	if (!outStream && !options.captureStdout) child.stdout.resume();
	if (!outStream && !options.captureStderr) child.stderr.resume();
	return {
		exited: new Promise((resolve, reject) => {
			child.once("error", reject);
			child.stdout.once("error", reject);
			child.stderr.once("error", reject);
			child.once("close", (code, signal) => resolve({
				code,
				signal,
				stdout,
				stderr
			}));
		}),
		kill(signal) {
			child.kill(signal);
		},
		detach() {
			if (outStream) {
				child.stdout.unpipe(outStream);
				child.stderr.unpipe(outStream);
			}
			child.stdout.destroy();
			child.stderr.destroy();
			child.unref();
		}
	};
}
function runProcess(command, args, options = {}) {
	return startProcess(command, args, options).exited;
}
function exitReason(result) {
	return result.signal ? `terminated by signal ${result.signal}` : `exit code ${result.code}`;
}
function stderrDetail(stderr) {
	const trimmed = stderr.trim();
	return trimmed ? `: ${trimmed}` : "";
}
//#endregion
//#region src/clever.ts
const DEPLOY_TERMINATION_GRACE_PERIOD_MS = 5e3;
const DEPLOY_FORCE_KILL_WAIT_MS = 5e3;
function cleverClient(deps) {
	const { cliPath, cwd, output, host } = deps;
	return {
		async linkedAppAlias(appID) {
			const result = await runProcess(cliPath, ["applications", "--json"], {
				cwd,
				captureStdout: true,
				captureStderr: true
			});
			if (result.code !== 0 || result.signal) throw new Error(`Failed to list linked applications (${exitReason(result)})` + stderrDetail(result.stderr));
			return parseLinkedAppAlias(result.stdout, appID);
		},
		async link(appID) {
			const result = await runProcess(cliPath, [
				"link",
				appID,
				"--alias",
				appID
			], {
				cwd,
				outStream: output
			});
			if (result.code !== 0 || result.signal) throw new Error(`Failed to link application ${appID} (${exitReason(result)})`);
		},
		async setEnv(name, value, alias) {
			const args = ["env", "set"];
			if (alias) args.push("--alias", alias);
			args.push(name, value);
			if (value) host.maskSecret(value);
			host.info(`Setting environment variable ${name}`);
			const result = await runProcess(cliPath, args, {
				cwd,
				captureStderr: true
			});
			if (result.code !== 0 || result.signal) throw new Error(`Failed to set environment variable ${name} (${exitReason(result)})` + stderrDetail(result.stderr));
		},
		async deploy(options) {
			const deployment = startProcess(cliPath, buildDeployArgs(options), {
				cwd,
				outStream: output
			});
			const result = options.timeoutSeconds ? await raceAgainstTimeout(deployment, options.timeoutSeconds * 1e3) : await deployment.exited;
			if (result === "timed-out") {
				await terminateDeployment(deployment);
				return "timed-out";
			}
			if (result.signal) throw new Error(`Deployment terminated by signal ${result.signal}`);
			if (result.code !== 0) throw new Error(`Deployment failed with code ${result.code}`);
			return "deployed";
		}
	};
}
function buildDeployArgs(options) {
	const args = ["deploy"];
	if (options.alias) args.push("--alias", options.alias);
	if (options.force) args.push("--force");
	if (options.sameCommitPolicy) args.push("--same-commit-policy", options.sameCommitPolicy);
	return args;
}
function parseLinkedAppAlias(json, appID) {
	let applications;
	try {
		applications = JSON.parse(json);
	} catch (error) {
		throw new Error("Clever CLI returned invalid linked application data", { cause: error });
	}
	if (!Array.isArray(applications)) throw new Error("Clever CLI returned invalid linked application data");
	const linkedApplication = applications.find((application) => typeof application === "object" && application !== null && "app_id" in application && application.app_id === appID);
	if (!linkedApplication) return;
	if (typeof linkedApplication.alias !== "string" || linkedApplication.alias.length === 0) throw new Error(`Application ${appID} is linked without a valid alias`);
	return linkedApplication.alias;
}
async function raceAgainstTimeout(deployment, timeoutMs) {
	let timeoutID;
	const expired = new Promise((resolve) => {
		timeoutID = setTimeout(() => resolve("timed-out"), timeoutMs);
	});
	try {
		return await Promise.race([deployment.exited, expired]);
	} finally {
		clearTimeout(timeoutID);
	}
}
async function terminateDeployment(deployment) {
	const settledExit = deployment.exited.then(() => void 0, () => void 0);
	deployment.kill("SIGTERM");
	let graceTimeoutID;
	const gracePeriodExpired = new Promise((resolve) => {
		graceTimeoutID = setTimeout(() => resolve(true), DEPLOY_TERMINATION_GRACE_PERIOD_MS);
	});
	const forced = await Promise.race([settledExit.then(() => false), gracePeriodExpired]);
	clearTimeout(graceTimeoutID);
	if (!forced) return;
	deployment.kill("SIGKILL");
	let waitTimeoutID;
	const forceKillWaitExpired = new Promise((resolve) => {
		waitTimeoutID = setTimeout(() => resolve(false), DEPLOY_FORCE_KILL_WAIT_MS);
	});
	const exitedAfterForceKill = await Promise.race([settledExit.then(() => true), forceKillWaitExpired]);
	clearTimeout(waitTimeoutID);
	if (!exitedAfterForceKill) deployment.detach();
}
//#endregion
//#region src/config.ts
const __dirname = path.dirname(fileURLToPath(import.meta.url));
function throwMissingEnvVar(name) {
	throw new Error(`Missing ${name} environment variable: https://err.sh/47ng/actions-clever-cloud/env`);
}
const ENV_LINE_REGEX = /^([a-zA-Z0-9-_.]+)=(.*)$/;
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
function parseEnvValue(value) {
	const quote = value[0];
	if (quote !== "\"" && quote !== "'") return value;
	let closingQuoteIndex = 1;
	let escaped = false;
	while (closingQuoteIndex < value.length) {
		if (value[closingQuoteIndex] === quote && !escaped) break;
		escaped = value[closingQuoteIndex] === "\\";
		closingQuoteIndex += 1;
	}
	if (closingQuoteIndex !== value.length - 1) return;
	const quotedValue = value.slice(1, closingQuoteIndex);
	const quotePattern = quote === "\"" ? /([\\]*)"/g : /([\\]*)'/g;
	return quotedValue.replace(quotePattern, (_, slashes) => {
		return "\\".repeat((slashes.length - 1) / 2) + quote;
	});
}
function listExtraEnv() {
	const extraEnv = core.getMultilineInput("setEnv", { trimWhitespace: false }).map((line) => line.replace(/\r$/, "").trimStart()).reduce((env, line) => {
		if (line === "") return env;
		const match = line.match(ENV_LINE_REGEX);
		if (!match) {
			if (!line.startsWith("#")) core.warning(`Ignoring setEnv line that is not KEY=value (keys are [A-Za-z0-9_.-]): ${redactValue(line)}`);
			return env;
		}
		const key = match[1];
		if (key === "__proto__") {
			core.warning(`Ignoring setEnv line with key: ${redactValue(line)}`);
			return env;
		}
		const value = parseEnvValue(match[2]);
		if (value === void 0) {
			core.warning(`Ignoring setEnv line with invalid quotes: ${redactValue(line)}`);
			return env;
		}
		env[key] = value;
		return env;
	}, {});
	if (Object.keys(extraEnv).length) {
		core.info("Setting extra environment variables:");
		for (const envName in extraEnv) core.info(`  ${envName}`);
	}
	return extraEnv;
}
function parseConfig() {
	if (!process.env.CLEVER_TOKEN) throwMissingEnvVar("CLEVER_TOKEN");
	if (!process.env.CLEVER_SECRET) throwMissingEnvVar("CLEVER_SECRET");
	const appID = core.getInput("appID") || void 0;
	const alias = core.getInput("alias") || void 0;
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
//#region src/deployment.ts
async function deploy(config, deps) {
	const { clever, git, host, deployLog } = deps;
	await git.checkForShallowCopy();
	const alias = config.appID ? await resolveAlias(config.appID, clever, host) : config.alias;
	for (const [name, value] of Object.entries(config.extraEnv)) await clever.setEnv(name, value, alias);
	if (await clever.deploy({
		alias,
		force: config.force,
		sameCommitPolicy: config.sameCommitPolicy,
		timeoutSeconds: config.timeout
	}) === "timed-out") {
		if (config.quiet && config.logFile) deployLog?.write("Deployment timed out, moving on with workflow run\n");
		host.info("Deployment timed out, moving on with workflow run");
	}
}
async function resolveAlias(appID, clever, host) {
	const linkedAlias = await clever.linkedAppAlias(appID);
	if (linkedAlias) {
		host.debug(`Application ${appID} is already linked as ${linkedAlias}`);
		return linkedAlias;
	}
	host.debug(`Linking ${appID}`);
	await clever.link(appID);
	return appID;
}
//#endregion
//#region src/git.ts
async function fixGitDubiousOwnership(run = runProcess) {
	const result = await run("git", [
		"config",
		"--global",
		"--add",
		"safe.directory",
		"/github/workspace"
	], { captureStderr: true });
	if (result.code !== 0 || result.signal) throw new Error(`Failed to mark /github/workspace as a git safe.directory (${exitReason(result)})` + stderrDetail(result.stderr));
}
async function checkForShallowCopy(run = runProcess) {
	const result = await run("git", ["rev-parse", "--is-shallow-repository"], {
		captureStdout: true,
		captureStderr: true
	});
	if (result.code !== 0 || result.signal) throw new Error(`Failed to check for a shallow working copy (${exitReason(result)})` + stderrDetail(result.stderr));
	if (result.stdout.trim() === "true") throw new Error(`This action requires an unshallow working copy.
-> Use the following step before running this action:
 - uses: actions/checkout@v3
   with:
     fetch-depth: 0
`);
}
//#endregion
//#region src/github.ts
function gitHubHost() {
	return {
		info: core.info,
		debug: core.debug,
		warning: core.warning,
		maskSecret: core.setSecret,
		fail: core.setFailed
	};
}
//#endregion
//#region src/output.ts
const TIMESTAMP_PREFIX_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[+-]\d{2}:\d{2}|Z):? /;
async function createDeployLog(options, host) {
	const { quiet, logFile, consoleStream = process.stdout } = options;
	const tee = new PassThrough();
	const completions = [];
	let liveSinkCount = 0;
	const degrade = (sink, error) => {
		host.warning(`deploy log output degraded (${sink}): ${error instanceof Error ? error.message : String(error)}`);
	};
	const monitor = (sink, completion, unpipeDeadSink) => {
		liveSinkCount += 1;
		completions.push(completion.catch((error) => {
			degrade(sink, error);
			unpipeDeadSink();
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
				const isAnnotation = /^::(?:notice|error|warning)(?:::| .*::)/i.test(message.trimStart());
				if (message !== line && isAnnotation) yield message + lineSeparator;
			}
		}
		const chainInput = new PassThrough();
		tee.pipe(chainInput);
		const onConsoleError = () => {};
		consoleStream.on("error", onConsoleError);
		monitor("console", pipeline(chainInput, splitNewlines, injectAnnotations, (lines) => writeLinesToConsole(consoleStream, lines)).finally(() => {
			consoleStream.off("error", onConsoleError);
		}), () => tee.unpipe(chainInput));
		finished(tee).catch((error) => chainInput.destroy(error));
	}
	if (logFile) try {
		const logFileStream = (await fs.open(logFile, "w")).createWriteStream();
		tee.pipe(logFileStream);
		monitor("log file", finished(logFileStream), () => tee.unpipe(logFileStream));
		finished(tee).catch((error) => logFileStream.destroy(error));
	} catch (error) {
		degrade("log file", error);
	}
	if (liveSinkCount === 0) tee.resume();
	const done = async () => {
		await Promise.all(completions);
	};
	return {
		stream: tee,
		done
	};
}
function throwIfConsoleDead(consoleStream) {
	if (consoleStream.errored) throw consoleStream.errored;
	if (consoleStream.closed || consoleStream.destroyed || consoleStream.writableEnded) throw new Error("console stream closed while writing deploy logs");
}
async function waitForDrain(consoleStream) {
	throwIfConsoleDead(consoleStream);
	const abort = new AbortController();
	try {
		await Promise.race([once(consoleStream, "drain", { signal: abort.signal }), once(consoleStream, "close", { signal: abort.signal }).then(() => {
			throw consoleStream.errored ?? /* @__PURE__ */ new Error("console stream closed while awaiting drain");
		})]);
	} finally {
		abort.abort();
	}
}
async function writeLinesToConsole(consoleStream, lines) {
	for await (const line of lines) {
		throwIfConsoleDead(consoleStream);
		if (!consoleStream.write(line)) await waitForDrain(consoleStream);
	}
	throwIfConsoleDead(consoleStream);
}
//#endregion
//#region src/main.ts
async function main() {
	const host = gitHubHost();
	let log;
	try {
		await fixGitDubiousOwnership();
		const config = parseConfig();
		log = await createDeployLog({
			quiet: config.quiet,
			logFile: config.logFile
		}, host);
		const cwd = await resolveDeployPath(config.deployPath, host);
		host.debug(`Clever CLI path: ${config.cleverCLI}`);
		await deploy(config, {
			clever: cleverClient({
				cliPath: config.cleverCLI,
				cwd,
				output: log.stream,
				host
			}),
			git: { checkForShallowCopy },
			host,
			deployLog: log.stream
		});
	} catch (error) {
		if (error instanceof Error && error.stack) host.debug(error.stack);
		host.fail(error instanceof Error ? error.message : String(error));
	} finally {
		if (log) {
			log.stream.end();
			await log.done();
		}
	}
}
async function resolveDeployPath(deployPath, host) {
	if (!deployPath) return;
	try {
		await fs.access(deployPath);
	} catch {
		throw new Error(`Deploy path does not exist: ${deployPath}`);
	}
	host.info(`Running Clever CLI from directory: ${deployPath}`);
	return deployPath;
}
if (import.meta.main) main();
//#endregion
export { main };

//# sourceMappingURL=main.js.map