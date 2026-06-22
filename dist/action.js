"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processArguments = void 0;
const core = __importStar(require("@actions/core"));
const exec_1 = require("@actions/exec");
const path_1 = __importDefault(require("path"));
const timers_1 = require("timers");
function throwMissingEnvVar(name) {
    throw new Error(`Missing ${name} environment variable: https://err.sh/47ng/actions-clever-cloud/env`);
}
function listExtraEnv() {
    const envLineRegex = /^(\w+)=(.*)$/;
    const extraEnv = core
        .getMultilineInput('setEnv')
        .map(line => line.trim())
        .reduce((env, line) => {
        const match = line.match(envLineRegex);
        if (!match) {
            return env;
        }
        const key = match[1];
        const value = match[2];
        env[key] = value;
        return env;
    }, {});
    if (Object.keys(extraEnv).length) {
        core.info('Setting extra environment variables:');
        for (const envName in extraEnv) {
            core.info(`  ${envName}`);
        }
    }
    return extraEnv;
}
function processArguments() {
    const token = process.env.CLEVER_TOKEN;
    const secret = process.env.CLEVER_SECRET;
    if (!token) {
        throwMissingEnvVar('CLEVER_TOKEN');
    }
    if (!secret) {
        throwMissingEnvVar('CLEVER_SECRET');
    }
    const appID = core.getInput('appID');
    const alias = core.getInput('alias');
    const force = core.getBooleanInput('force');
    const timeout = parseInt(core.getInput('timeout')) || undefined;
    return {
        token,
        secret,
        alias,
        force,
        appID,
        timeout,
        cleverCLI: path_1.default.resolve(__dirname, '../node_modules/.bin/clever'),
        extraEnv: listExtraEnv()
    };
}
exports.processArguments = processArguments;
async function checkForShallowCopy() {
    let output = '';
    await (0, exec_1.exec)('git', ['rev-parse', '--is-shallow-repository'], {
        listeners: {
            stdout: (data) => (output += data.toString())
        }
    });
    if (output.trim() === 'true') {
        throw new Error(`This action requires an unshallow working copy.
-> Use the following step before running this action:
 - uses: actions/checkout@v3
   with:
     fetch-depth: 0
`);
    }
}
async function run({ token, secret, appID, alias, force, cleverCLI, timeout, extraEnv = {} }) {
    try {
        await checkForShallowCopy();
        core.debug(`Clever CLI path: ${cleverCLI}`);
        // Authenticate (this will only store the credentials at a known location)
        await (0, exec_1.exec)(cleverCLI, ['login', '--token', token, '--secret', secret]);
        // There is an issue when there is a .clever.json file present
        // and only the appID is passed: link will work, but deploy will need
        // an alias to know which app to publish. In this case, we set the alias
        // to the appID, and the alias argument is ignored if also specified.
        if (appID) {
            core.debug(`Linking ${appID}`);
            await (0, exec_1.exec)(cleverCLI, ['link', appID, '--alias', appID]);
            alias = appID;
        }
        // If there are environment variables to pass to the application,
        // set them before deployment so the new instance can use them.
        for (const envName of Object.keys(extraEnv)) {
            const args = ['env', 'set'];
            if (alias) {
                args.push('--alias', alias);
            }
            args.push(envName, extraEnv[envName]);
            await (0, exec_1.exec)(cleverCLI, args);
        }
        const args = ['deploy'];
        if (appID) {
            args.push('--alias', appID);
        }
        else if (alias) {
            args.push('--alias', alias);
        }
        if (force) {
            args.push('--force');
        }
        if (timeout) {
            let timeoutID;
            let timedOut = false;
            const timeoutPromise = new Promise(resolve => {
                timeoutID = (0, timers_1.setTimeout)(() => {
                    timedOut = true;
                    resolve();
                }, timeout);
            });
            const result = await Promise.race([(0, exec_1.exec)(cleverCLI, args), timeoutPromise]);
            if (timeoutID) {
                (0, timers_1.clearTimeout)(timeoutID);
            }
            if (timedOut) {
                core.info('Deployment timed out, moving on with workflow run');
            }
            core.info(`result: ${result}`);
            if (typeof result === 'number' && result !== 0) {
                throw new Error(`Deployment failed with code ${result}`);
            }
        }
        else {
            const code = await (0, exec_1.exec)(cleverCLI, args);
            core.info(`code: ${code}`);
            if (code !== 0) {
                throw new Error(`Deployment failed with code ${code}`);
            }
        }
    }
    catch (error) {
        if (error instanceof Error) {
            core.setFailed(error.message);
        }
        else {
            core.setFailed(String(error));
        }
    }
}
exports.default = run;
