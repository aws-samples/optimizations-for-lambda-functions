import { logger, tracer } from "../powertools/utilities.ts";
import { DBParams } from './DBValueObject.ts';
import { SSMClient, GetParametersCommand } from "@aws-sdk/client-ssm";

class DBparameters {
    private PARAMS_ID_LIST = [
      "/lambda-optimized/dbUsername",
      "/lambda-optimized/dbName",
      "/lambda-optimized/dbPort",
      "/lambda-optimized/dbEndpoint"];
      private client: SSMClient;

  constructor(){
    this.client = tracer.captureAWSv3Client(new SSMClient({region: process.env.AWS_REGION}));
  }

  @tracer.captureMethod({
    subSegmentName: "### get DB parameters"
  })
  public async getParameters(){
    const params: { [key: string]: any } = {};

    try{
      const input = { 
        Names: this.PARAMS_ID_LIST,
      };
      const command = new GetParametersCommand(input);
      const response = await this.client.send(command);
  
      response.Parameters!.forEach(parameter => {
        params[parameter.Name!.split("/").pop() as string] = parameter.Value!;
      });
  
      const dbParams:DBParams = {
        database: params.dbName,
        user: params.dbUsername,
        endpoint: params.dbEndpoint,
        password: "",
        port: Number(params.dbPort),
      }
      
      logger.info(`DB params: ${dbParams}`);
      return dbParams;
    } catch(error){
      const rootTraceId = tracer.getRootXrayTraceId();
      logger.error(`Unexpected error occurred while trying to retrieve stadiums. TraceID: ${rootTraceId}`, error as Error);
      throw error;
    }    
  }

}

export { DBparameters }