import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { Database } from './database/sequelize.js';
import { DBParams } from './database/DBValueObject.js';
import stadiumData from './stadium-data.json';
import { DBparameters } from './database/DBparametersSDK.ts';
import { logger, tracer } from "./powertools/utilities.js";
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer';
import { injectLambdaContext } from '@aws-lambda-powertools/logger';
import middy from "@middy/core";

const parameters = new DBparameters()
const parametersList:DBParams = await parameters.getParameters();

const lambdaHandler = async function (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    logger.info('DB params retrieved', { details: { dbParams: parametersList } });
    
    const db = new Database();
    await db.init(parametersList);
    await db.authenticate();
    await db.stadiums.sync({ force: true });
    for(const stadium of stadiumData.stadiums) {
      await db.stadiums.create(stadium);
    }
    logger.info('total stadiums created', { details: { total_stadiums: stadiumData.stadiums.length } });

    return {
      statusCode: 201,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ "message": "Stadium table and data successfully created." })
    };

  } catch (error) {
    console.error('Unable to connect to the database:', error);
    
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(error)
    }
  }
};

export const handler = middy(lambdaHandler)
                        .use(captureLambdaHandler(tracer))
                        .use(injectLambdaContext(logger, { clearState: true }));