import postgres from 'postgres';
import { Signer } from 'aws-sdk-js-v3-rds-signer';
import { DBParams } from './DBValueObject.ts';
import { logger, tracer } from "../powertools/utilities.ts";
import { Stadium } from "./StadiumValueObject.ts";

class PostgresDB {
    private sql: postgres.Sql<Record<string, unknown>>;

    @tracer.captureMethod({
        subSegmentName: "### authenticate to DB"
    })
    public async init(params:DBParams){
        if(!this.sql){
            const signer = new Signer({
                hostname: params.endpoint,
                port: params.port,
                region: process.env.AWS_REGION,
                username: params.user
            });
            
            const psw = await signer.getAuthToken()
            
            this.sql = postgres({
                host:params.endpoint,
                port:params.port,
                database:params.database,
                username:params.user,
                password: psw,
                ssl: true,
                idle_timeout: 40,
                max_lifetime: 60 * 3,
                transform: postgres.camel
            })
        }
    }

    @tracer.captureMethod({
        subSegmentName: "### Get ALL stadiums"
    })
    public async getAllStadiums(){
        return await this.sql`SELECT * FROM stadiums`
    }

    @tracer.captureMethod({
        subSegmentName: "### close DB connection"
    })
    public async close(){
        return await this.sql.end();
    }

    @tracer.captureMethod({
        subSegmentName: "### insert all stadiums"
    })
    public async insertStadiums(stadiums:Array<Stadium>){

        await this.sql`
            CREATE TABLE IF NOT EXISTS stadiums (
                name TEXT,
                capacity INTEGER,
                location TEXT,
                surface TEXT,
                roof TEXT,
                team TEXT,
                year_opened TEXT,
                created_at TIMESTAMP,
                update_at TIMESTAMP
            )`

        await this.sql`TRUNCATE stadiums`

        const result = await this.sql.begin(async sql => {

            stadiums.forEach(async stadium => {
                const data = await sql`
                INSERT into stadiums ${ sql({
                    ...stadium,
                    "createdAt": Date.now(),
                    "updateAt": Date.now()
                }) }`
            })
                
        })

        return result;
    }
}

export { PostgresDB }