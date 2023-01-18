const mongoose = require('mongoose');
const redis = require('redis');
const util = require('util');

const redisUrl = 'redis://127.0.0.1:6379';
const client = redis.createClient(redisUrl);
client.hget = util.promisify(client.hget);
const exec = mongoose.Query.prototype.exec;

mongoose.Query.prototype.cache = function(options = {}) {
  this.useCache = true;
  this.cacheKey = JSON.stringify(options.key || '');

  return this;
}

mongoose.Query.prototype.exec = async function(){
  if(!this.useCache){
    return exec.apply(this, arguments);
  }

  const key = JSON.stringify(
    Object.assign({}, this.getQuery(), {
      collection: this.mongooseCollection.name
    })
  );

  // check for response result in cache first
  const cacheValue = await client.hget(this.cacheKey, key);
  if(cacheValue){
    const doc = JSON.parse(cacheValue);

    if(Array.isArray(doc)){
      return doc.map(d => new this.model(d));
    }

    return new this.model(doc);
  }
  
  // query db if cache miss
  const result = await exec.apply(this, arguments);
  client.hset(this.cacheKey, key, JSON.stringify(result));

  return result;
}

module.exports = {
  clearHash(key) {
    client.del(JSON.stringify(key));
  }
};