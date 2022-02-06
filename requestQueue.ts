import {sleep} from "./helper";

type RequestFinishedFunction = (result: any) => void
type RequestType = ((args: any) => Promise<any>) | (() => Promise<any>)

interface QueueItem {
    request: RequestType,
    args?: any,
    isPaginated: boolean,
    resolve: RequestFinishedFunction,
    reject: RequestFinishedFunction,
}

export class RequestQueue {
    queue: QueueItem[] = []
    interval: number
    paused: boolean = false
    looping: boolean = false

    constructor(intervalMillis: number) {
        this.interval = intervalMillis
    }

    push(request: RequestType, args?: any, isPaginated: boolean = false): Promise<any> {
        const promise = new Promise((resolve: RequestFinishedFunction, reject: RequestFinishedFunction) => {
            this.queue.push({
                request,
                args,
                isPaginated,
                resolve,
                reject,
            })
        })
        console.debug("Enqueueing", request)
        if (!this.looping && !this.paused) {
            this.loop().then()
        }
        return promise
    }

    togglePaused() {
        this.paused = !this.paused
        if (!this.paused) {
            this.loop().then()
        }
    }

    private async loop(): Promise<void> {
        this.looping = true
        let nextInterval = this.interval
        console.debug("Started queue-looping")
        while (!this.paused) {
            const toSleep = sleep(nextInterval)
            if (!this.isEmpty()) {
                const next = this.queue[0]

                try {
                    let res;
                    res = await next.request(next.args)
                    if (next.isPaginated) {
                        let results = res.results
                        while (res.has_more) {
                            res = await next.request({
                                ...(next.args ?? {}),
                                next_cursor: res.next_cursor
                            })
                            results = results.concat(res.results)
                        }
                        next.resolve(results)
                    } else {
                        next.resolve(res)
                    }
                } catch (e) {
                    console.error("Failed queue item", e)
                    next.reject(new QueueError(e))
                }
                this.queue.shift()
            }
            await toSleep
        }
        console.debug("Quit queue-looping")
        this.looping = false
    }

    isEmpty() {
        return this.queue.length === 0;
    }

    async letQueueEmpty() {
        while (!this.isEmpty()) {
            if (this.paused) {
                throw new Error("Queue paused")
            }
            await sleep(this.interval)
        }
    }
}

class QueueError extends Error {
    innerError: any

    constructor(innerErorr: any, message?: string) {
        super(message);
        this.innerError = innerErorr
    }

}
