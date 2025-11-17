import http, { IncomingMessage } from 'http'
import fs from 'fs'
import { cwd } from 'process'
import zlib from 'zlib'

if (!process.env.JMDICT_FILE_LINK) {
    throw new Error("Environment variable JMDICT_FILE_LINK is not defined")
}
if (!process.env.JMDICT_GZ_NAME) {
    throw new Error("Environment variable JMDICT_GZ_NAME is not defined")
}

if (!fs.existsSync(`${cwd()}/sources`)) {
    fs.mkdirSync(`${cwd()}/sources`, { recursive: true })
}

const gzUrl = `${cwd()}/sources/${process.env.JMDICT_GZ_NAME}`
const xmlUrl = `${gzUrl.replace(/\.gz$/, '.xml')}`

if (fs.existsSync(gzUrl))
    fs.rmSync(gzUrl, { recursive: false, force: true })
if(fs.existsSync(xmlUrl))
    fs.rmSync(xmlUrl, { recursive: false, force: true })

const file = fs.createWriteStream(gzUrl)
const downloadPromise = new Promise((resolve, reject) => {
    http.get(process.env.JMDICT_FILE_LINK as string, (response: IncomingMessage) => {
        
        const total = parseInt(response.headers['content-length'] || '0', 10)
        let downloaded = 0
         response.on('data', (chunk) => {
            downloaded += chunk.length
            if (total) {
                const percent = ((downloaded / total) * 100).toFixed(2)
                process.stdout.write(`\rDownloading JMDict file... ${percent}%`)
            }
        })

        response.pipe(file)

        file.on("finish", () => {
            file.close()
            console.log("\rDownload Completed")
            resolve(true)
        })
        file.on("error", (err) => {
            console.error("\rError writing file:", err)
            reject(err)
        })
    })
})
await downloadPromise

const unzip = fs.createWriteStream(xmlUrl)
console.log("Extracting JMDict GZ file...")
const extractPromise = new Promise((resolve, reject) => {
fs.createReadStream(gzUrl)
    .pipe(zlib.createGunzip())
    .pipe(unzip)
    .on('finish', () => {
        console.log(`Extracted to ${xmlUrl}`)
        resolve(true)
    })
    .on('error', (err) => {
        console.error('Extraction error:', err)
        reject(err)
    })
})
await extractPromise

console.log("Cleaning up...")
fs.rmSync(gzUrl, { recursive: false, force: true })
console.log("JMDict download and extraction completed successfully.")