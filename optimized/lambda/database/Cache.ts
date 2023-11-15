import { createClient } from '@redis/client';
import { logger, tracer  } from '../powertools/utilities.ts';

class Cache{
    private client:any

    @tracer.captureMethod({
        subSegmentName: "### Redis init"
    })
    async init(endpoint:String, port:Number){
        try{
            if(!this.client){
                this.client = await createClient({
                    url: `redis://${endpoint}:${port}`
                })
                .on('error', err => logger.error(`Redis client error redis://${endpoint}:${port}`, err))
                .connect();
            }
        } catch (err) {
            const rootTraceId = tracer.getRootXrayTraceId();
            logger.error(`Cannot connect to Redis. redis://${endpoint}:${port}. TraceId ${rootTraceId}`, err as Error)
        }
        
    }

    @tracer.captureMethod({
        subSegmentName: "### Redis get data"
    })
    async getData(key:string){

        try{
            const res = await this.client.get(key);
    
            if(res)
                return JSON.parse(res);
            else 
                return undefined;
            
        } catch(err) {
            const rootTraceId = tracer.getRootXrayTraceId();
            logger.error(`Cannot get data from Redis. TraceId ${rootTraceId}`, err as Error)
        }
    }

    @tracer.captureMethod({
        subSegmentName: "### Redis set data"
    })
    async setData(key:string, value:any){
        try{
            if(!this.client.isOpen)
                await this.client.connect();

            await this.client.set(
                key,
                JSON.stringify(value),
                {
                    EX: 10,
                    NX: true
                });
        } catch (err) {
            const rootTraceId = tracer.getRootXrayTraceId();
            logger.error(`Cannot get data from Redis. TraceId ${rootTraceId}`, err as Error)
        }
    }

}

export { Cache }