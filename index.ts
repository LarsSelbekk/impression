import {Client} from "@notionhq/client"
import {execFile} from "child_process"
import * as crypto from "crypto"
import {parseAssignments, parseWildcards, readConfig, sleep} from "./helper";
import {
    clearAllOfRecurrenceSeries,
    clearExecute,
    generateEntry,
    getTextContent, letQueueEmpty,
    queryAll,
    getChildren,
    writeError
} from "./notionApi";

export const config = readConfig()
export const notion = new Client({
    auth: config.token,
})

let finished = false

main().then()

async function main(): Promise<void> {
    while (!finished) {
        try {
            console.debug("Looping")
            await doLoop()
        } catch (e) {
            console.error("Loop failed", e)
        }
        await letQueueEmpty()
        await sleep(config.pollInterval)
    }
}

async function doLoop(): Promise<void> {
    const repeatables = (await queryAll(notion.databases.query, {database_id: config.databaseId}))
        .filter(
            // @ts-ignore
            r => r.properties["Execute"].checkbox
        )
        // @ts-ignore
        .filter(r => getTextContent(r, "Repeat") !== undefined)
    // TODO: concurrent
    console.debug(repeatables)
    for (const repeatable of repeatables) {
        const newRecurrenceId = crypto.randomUUID()
        await clearExecute(repeatable, newRecurrenceId)
        await clearAllOfRecurrenceSeries(getTextContent(repeatable, "Recurrence ID"))
        // @ts-ignore
        const repeat = getTextContent(repeatable, "Repeat")
        const assignments = parseAssignments(getTextContent(repeatable, "Assignments"))

        // @ts-ignore
        const titleTemplate = parseWildcards(repeatable.properties["Name"].title[0].plain_text)
        // TODO: num params vs args checking. num assignments vs num repeats
        // TODO: alarm
        if (assignments == null || titleTemplate.length-1 !== ((assignments[0] ?? []).length)) {
            await writeError(repeatable, "Assignments", `Should fill ${titleTemplate.length-1} variables`)
        } else {
            let errored = false
            // @ts-ignore
            const children = await getChildren(repeatable)
            const onReceive = async (error: unknown | null, stdout: string, stderr: string) => {
                if (stderr.length > 0) {
                    errored = true
                    console.error("From python:\n" + stderr)
                }
                if (errored) return
                if (stdout.length == 0) return
                const dates = stdout.split("\n")
                if (stdout.includes("MalformedRRule")) {
                    await writeError(repeatable, "Repeat")
                    errored = true
                    return
                }
                if (stdout.includes("NonExistantDate")) {
                    await writeError(repeatable, "Repeat", "Non-existant date")
                    errored = true
                    return
                }
                if (titleTemplate.length > 1 && dates.length !== assignments.length) {
                    await writeError(repeatable, "Assignments", `Should fill ${dates.length} dates`)
                    errored = true
                    return
                }
                for (let i = 0; i < dates.length; i++) {
                    await generateEntry(
                        repeatable,
                        dates[i].trim(),
                        newRecurrenceId,
                        titleTemplate,
                        assignments[i] ?? [],
                        children
                    )
                }
            }
            const dateHandler = execFile(config.pythonPath ?? "python", ["main.py"], onReceive)
            // TODO parse dates from properties/time
            // Due dates temporarily set to arbitrary date in the past to generate all; could parse Due date-property later
            dateHandler.stdin?.write(repeat + "\t" + `2020-02-25` + "\t" + `2020-02-26` + "\t" + `0`)
            dateHandler.stdin?.end()
        }
    }
}
