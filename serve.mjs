import http from 'node:http';
import worker from './dist/server/index.mjs';
const port=Number(process.env.PORT||3000);
http.createServer(async(req,res)=>{try{const response=await worker.fetch(new Request(new URL(req.url,'http://localhost:'+port)));res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()))}catch(e){res.writeHead(500);res.end('Request failed')}}).listen(port,'127.0.0.1',()=>console.log('SELENE: http://localhost:'+port));
