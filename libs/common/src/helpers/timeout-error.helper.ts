import { BadRequestException, RequestTimeoutException } from "@nestjs/common";
import { Observable, TimeoutError, catchError, timeout } from "rxjs";


export function handleTimeoutAndErrors<T = unknown>() {
    return (sourse$: Observable<T>) => sourse$.pipe(timeout(5000), catchError((err) => {
        if (err instanceof TimeoutError) {
            throw new RequestTimeoutException()
        }
        throw new BadRequestException(err)
    }))
}