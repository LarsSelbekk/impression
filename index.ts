import {Client} from "@notionhq/client"
import {readFileSync} from "fs"
import {execFile} from "child_process";

const DB = "4fa46ea34e9547ab8ae5427bf5978d01";

interface Config {
    token: string,
}

main().then()
interface Repeatable {
    name: string,
    repeat: string,
    dueDate: string,
    firstDueDate?: string,
}

async function main() {
    const config = JSON.parse(readFileSync(".config.json", "utf-8")) as Config
    const notion = new Client({
        auth: config.token,
    })
    const repeatables = (await notion.databases.query({database_id: DB}))
        .results
        .filter(
            r => Object.keys(r.properties).includes("Repeat")
        )
        .map(
            r => ({
                // @ts-ignore
                name: r.properties["Name"].title[0]?.text.content,
                // @ts-ignore
                repeat: r.properties["Repeat"].rich_text[0]?.plain_text,
                // @ts-ignore
                dueDate: r.properties["Due date"].date?.start,
                // @ts-ignore
                firstDueDate: r.properties["First due date"].date?.start,
            }))
        .filter(r => r.repeat !== undefined)
    // TODO: If repeat and "Due date" but no "First due date", latter := former
    console.log(repeatables)
    const dateHandler = execFile("python", ["main.py"], onReceive(repeatables, notion))
    // dateHandler.stdin?.write(repeatables[0].repeat + "\t" + repeatables[0].dueDate + "\t" + repeatables[0].firstDueDate)
    dateHandler.stdin?.write(`every 3 days` + "\t" + `2020-02-25` + "\t" + `2020-02-26`)
    dateHandler.stdin?.end()
}

const onReceive = (repeatables: Repeatable[], notion: Client) => (error: unknown | null, stdout: string, stderr: string) => {
    console.log("===stdout===")
    console.log(stdout)
    console.log("===stdout===")

    const generate = false

    if (error !== null) {
        console.error(error)
        if (stderr.length > 0) {
            console.error(stderr)
        }
    } else if (generate) {
        for (const line of stdout.split("\n")) {
            notion.pages.create({
                parent: {
                    database_id: DB
                },
                properties: {
                    "Name": {title: [{text: {content: repeatables[0].name,}}]},
                    "Due date": {
                        date: {
                            start: line.trim(),
                            end: null,
                        }
                    },
                    // "Repeat": { title: [ { text: { content: "", } } ] },
                }
            })
        }
    }
}
