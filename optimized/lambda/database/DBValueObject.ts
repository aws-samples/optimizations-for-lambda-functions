interface DBParams {
    database:string,
    endpoint:string,
    user:string,
    password:string,
    port:number,
    isCacheEnabled:boolean,
    cacheEndpoint:string,
    cachePort:number,
}

export {DBParams}