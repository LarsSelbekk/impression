import {readFileSync} from "fs";

export interface Config {
    token: string,
    databaseId: string,
    pollInterval: number,
    pythonPath?: string,
}

export async function sleep(millis: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, millis))
}

export function formatTemplate(template: string[], assignments: string[]): string {
    const result: string[] = []
    for (let i = 0; i < assignments.length; i++) {
        result.push(template[i])
        result.push(assignments[i])
    }
    result.push(template[template.length - 1])

    return result.join("")
}

export function parseAssignments(raw: string): string[][] | null {
    if (raw === "") {
        return []
    }

    const res: string[][] = raw.split("|").map(variable => variable.split(";"))

    if (res.filter(variable => variable.length !== res[0].length).length !== 0) {
        return null
    }
    return res
}

export function parseWildcards(raw: string): string[] {
    return raw.split("$")
}

export function readConfig(): Config {
    let res: Partial<Config> = {}
    try {
        res = JSON.parse(readFileSync(".config.json", "utf-8"))
    } catch (e) {
    }

    const {TOKEN, DATABASE_ID, POLL_INTERVAL, PYTHON_PATH} = process.env;
    const env: { [key: string]: any } = {
        token: TOKEN,
        databaseId: DATABASE_ID,
        pollInterval: POLL_INTERVAL ? parseInt(POLL_INTERVAL) : undefined,
        pythonPath: PYTHON_PATH
    }
    for (const variable of Object.keys(env)) {
        if (env[variable] !== undefined) {
            // @ts-ignore
            res[variable] = env[variable]
        }
    }

    if (!res.token || !res.databaseId || !res.pollInterval) {
        console.error("Missing environment variables")
        process.exit(1)
    }

    return res as Config
}
