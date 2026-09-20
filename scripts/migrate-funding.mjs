import {readFile} from 'node:fs/promises';
import {Pool} from '@neondatabase/serverless';
if(!process.env.DATABASE_URL)throw new Error('Configure DATABASE_URL before migrating');
const pool=new Pool({connectionString:process.env.DATABASE_URL});
try{await pool.query(await readFile(new URL('../migrations/001-funding.sql',import.meta.url),'utf8'));console.log('Funding migration applied');}finally{await pool.end();}
