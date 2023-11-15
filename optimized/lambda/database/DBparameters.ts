import { logger, tracer } from "../powertools/utilities.ts";
import { DBParams } from './DBValueObject.ts';

class DBparameters {
    private SESSION_TOKEN = process.env.AWS_SESSION_TOKEN!;
    private SSM_PORT = process.env.PARAMETERS_SECRETS_EXTENSION_HTTP_PORT!;
    private PARAMS_ID_LIST = [
      "/lambda-optimized/dbUsername",
      "/lambda-optimized/dbName",
      "/lambda-optimized/dbPort",
      "/lambda-optimized/dbEndpoint",
      "/lambda-optimized/isCacheEnabled",
      "/lambda-optimized/cacheEndpoint",
      "/lambda-optimized/cachePort"];

  public async getParameters(){
    const list:Array<String> = this.PARAMS_ID_LIST;
    const params: { [key: string]: any } = {};
    let parameterID:String;
    
    for(let i=0; i < list.length; i++){
      parameterID = list[i].toString();
      
      const param = await fetch(`http://localhost:${this.SSM_PORT}/systemsmanager/parameters/get?name=${parameterID}`,
      {
        method: "GET",
        headers: {
          'X-Aws-Parameters-Secrets-Token': this.SESSION_TOKEN
        }
      });

      if (param.ok) {
        const key = parameterID.split("/").pop() as string;
        const result = await param.json();
        params[key] = result.Parameter.Value;
      } else {
        logger.error(`Parameter ${list[i]} not retrieved | ${param.statusText}`);
      }
    } 

    const dbParams:DBParams = {
      database: params.dbName,
      user: params.dbUsername,
      endpoint: params.dbEndpoint,
      password: "",
      port: Number(params.dbPort),
      isCacheEnabled: params.isCacheEnabled.toLowerCase() === "true",
      cacheEndpoint: params.cacheEndpoint,
      cachePort: params.cachePort,
    }
    
    logger.info(`DB params: ${dbParams}`);
    return dbParams;
  }

}

export { DBparameters }