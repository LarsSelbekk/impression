import {formatTemplate} from "./helper";
import {config, notion} from "./index";
import {RequestQueue} from "./requestQueue";

type Block = {id: string, type: string, has_children?: boolean, children?: Block[], [str: string]: any}
type RequestResponse<T> = { results: T[], has_more: boolean, next_cursor: any }

const REQUEST_INTERVAL = 500
const queue = new RequestQueue(REQUEST_INTERVAL)

function redErrorTextBlock(message?: string) {
    return {
        type: "text",
        text: {content: "[ERROR" + (message ? ": " + message : "") + "]"},
        annotations: {
            bold: true,
            color: "red",
        }
    }
}

export function getTextContent(page: any, property: string): string {
    const parts = page.properties[property].rich_text.map((r: any) => r.plain_text)
    if (parts.length === 0) {
        return ""
    }
    return parts.join()
}

export async function generateEntry(generator: any, dueDate: string, newRecurrenceId: string,
                                    titleTemplate: string[], assignments: string[],
                                    children?: Block[]) {
    // TODO: Variables in description
    const formattedTitle = formatTemplate(titleTemplate, assignments)
    const res = await queue.push(notion.pages.create, {
        parent: {
            database_id: config.databaseId
        },
        properties: {
            ...filterProperties(generator.properties),
            "Name": {title: [{text: {content: formattedTitle}}]},
            "Due date": {
                date: {
                    start: dueDate,
                    end: null,
                }
            },
            "Recurrence ID": {rich_text: [{type: "text", text: {content: newRecurrenceId}}]}
        },
        icon: generator.icon,
        cover: generator.cover,
        children
    })
}

function filterProperties(properties: any): any {
    const forbiddenTypes = ["formula"]
    const forbiddenFields = ["Assignments", "Repeat", "Date Created", "Execute", "Last edited"
    + " time", "Last edited by", "ID", "Created by"]
    const ret: any = {}
    for (const key of Object.keys(properties)) {
        const val = properties[key]
        if (!forbiddenTypes.includes(val.type) && !forbiddenFields.includes(key)) {
            ret[key] = {
                type: val.type,
                [val.type]: val[val.type]
            }
        }
    }

    return ret
}

export async function writeError(repeatable: any, field: string, message: string = ""): Promise<void> {
    await queue.push(notion.pages.update, {
        page_id: repeatable.id, properties: {
            [field]: {
                ...repeatable.properties[field],
                rich_text: [
                    redErrorTextBlock(message),
                    ...repeatable.properties[field].rich_text
                ]
            },
        }
    })
}

export async function clearExecute(repeatable: any, newId: string): Promise<void> {
    await queue.push(notion.pages.update, {
        page_id: repeatable.id, properties: {
            "Execute": {
                checkbox: false
            },
            "Recurrence ID": {
                rich_text: [{type: "text", text: {content: newId}}]
            },
        }
    })
}

export async function clearAllOfRecurrenceSeries(id: string): Promise<void> {
    console.debug("Clearing all of id " + id)
    if (!id || !id.trim()) {
        return
    }
    const results = await queue.push(notion.databases.query, {
        database_id: config.databaseId, filter:
            {
                and: [
                    {property: "Recurrence ID", text: {equals: id}},
                    {property: "Repeat", text: {is_empty: true}}
                ]
            }
    }, true)
    for (const result of results) {
        await queue.push(notion.pages.update, {
            page_id: result.id,
            archived: true
        })
    }
}

export async function queryAll<T>(call: (obj: any) => Promise<RequestResponse<T>>, args: object)
    : Promise<T[]> {
    return await queue.push(call, args, true)
}

// TODO: Doesn't work with tables
export async function getChildren(parent: Block): Promise<Block[] | undefined> {
    if (!(parent.has_children ?? true)) {
        return undefined
    }

    const populateChildren = async (child: Block) => (
        {
            ...child,
            [child.type]: {
                ...child[child.type],
                children: await getChildren(child)
            }
        })

    if (parent.children !== undefined) {
    //     const children = await Promise.all(parent.children.map(populateChildren))
    //     return children.length > 0 ? children : undefined
        // TODO: recursively populate instead of filtering
        return parent.children.filter(child => !child.has_children)
    }

    const directChildren = await queryAll(notion.blocks.children.list, {
        block_id: parent.id,
    })
    // const children = (await Promise.all(directChildren.map(populateChildren)))
    // TODO: Just ignores children for now
    // @ts-ignore
    const children = directChildren.filter(child => !child.has_children)
    // @ts-ignore
    return children.length > 0 ? children : undefined
}

export function letQueueEmpty(): Promise<void> {
    return queue.letQueueEmpty()
}
