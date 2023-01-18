const mongoose = require('mongoose');
const redis = require('redis');
const util = require('util');

const redisUrl = 'redis://127.0.0.1:6379';
const client = redis.createClient(redisUrl);
client.get = utils.promisify(client.get);
const exec = mongoose.Query.prototype.exec;

mongoose.Query.prototype.exec = async function(){
  const key = JSON.stringify(
    Object.assign({}, this.getQuery(), {
      collection: this.mongooseCollection.name
    })
  );

  // check for response result in cache first
  const cacheValue = await client.get(key);
  if(cacheValue){
    const doc = JSON.parse(cacheValue);

    if(Array.isArray(doc))
      return doc.map(d => new this.model(d));

    return new this.model(doc);
  }
  
  // query db if cache miss
  const result = exec.apply(this, arguments);
  client.set(key, JSON.stringify(result));

  return result;
}