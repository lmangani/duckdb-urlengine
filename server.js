/** CLICKHOUSE URL Table Engine handler w/ Deta storage */
/** 

    Create a URL Engine table w/ a custom ID or hash identifier:

       CREATE TABLE default.url_engine_glitch
       (
           `key` String,
           `value` UInt64
       )
       ENGINE = URL('https://url-engine.glitch.me/mysuperspecialkey', 'JSONEachRow');
       
    Insert into the distributed table
       
       INSERT INTO default.url_engine_glitch VALUES ('glitch!', 1);
       
    Query / Fetch the remote table
       
       SELECT * from default.url_engine_glitch;

*/

const fastify = require("fastify")({ logger: true });

const { Deta } = require("deta");
const deta = Deta(process.env.DETA_TOKEN || false);
const db = deta.Base("shared"); // global shared db
var detas = {}; // detas tmp connection cache

/** CLICKHOUSE URL SELECT */
fastify.get("/:detabase", async (request, reply) => {
  console.log('!!!', request.params, request)
  const { detabase } = request.params;
  if (!detabase) return;
  if (!detas[detabase]) {
    detas[detabase] = deta.Base(detabase);
  }
  const db = detas[detabase];
  const { items } = await db.fetch();
  return items;
});

/** CLICKHOUSE URL INSERT */
fastify.post("/:detabase", async (request, reply) => {
  const { detabase } = request.params;
  if (!detabase) return;
  if (!detas[detabase]) {
    detas[detabase] = deta.Base(detabase);
  }
  const db = detas[detabase];
  request.body.forEach((row) => {
    db.put({ key: row.key, value: parseInt(row.value) });
  });
  return {};
});

/**
 * @param req {FastifyRequest}
 * @returns {Promise<string>}
 */
async function getContentBody(req) {
  let body = "";
  req.raw.on("data", (data) => {
    body += data.toString();
  });
  await new Promise((resolve) => req.raw.once("end", resolve));
  return body;
}

/**
 * @param req {FastifyRequest}
 * @returns {Promise<void>}
 */
async function genericJSONParser(req) {
  try {
    var body = await getContentBody(req);
    // x-ndjson to json
    const response = body
      .trim()
      .split("\n")
      .map(JSON.parse)
      .map((obj) =>
        Object.entries(obj)
          .sort()
          .reduce((o, [k, v]) => ((o[k] = v), o), {})
      );
    return response;
  } catch (err) {
    err.statusCode = 400;
    throw err;
  }
}

fastify.addContentTypeParser("*", {}, async function (req, body, done) {
  return await genericJSONParser(req);
});

/** RUN URL Engine */
const start = async () => {
  try {
    await fastify.listen(3000);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
