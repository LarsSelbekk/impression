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
