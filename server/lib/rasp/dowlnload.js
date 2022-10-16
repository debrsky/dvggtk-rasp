const config = require('../../../config');

const https = require('https');
const fs = require('fs');
const path = require('path');

const Papa = require('papaparse');

const URL_TEMPLATE = process.env.SRC_CSV_URL_TEMPLATE;
const RASP_STORAGE = path.join(config.rootDir, config.storage, 'rasp/csv');

async function download(db) {
	await fs.promises.mkdir(RASP_STORAGE, {recursive: true});

	const tables = Object.keys(db);

	let dataArray;
	try {
		dataArray = await Promise.all(
			tables.map((table) =>
				(async () => {
					return [table, await getData(db, table)];
				})()
			)
		);
	} catch (err) {
		console.error(err);
	}

	let hasNewData = false;

	if (dataArray) {
		dataArray.forEach(([table, data]) => {
			if (data) {
				db[table] = data;
				hasNewData = true;
			}
		});
	}

	return {hasNewData};
}

function parseCsv(csv) {
	const db = Papa.parse(csv, {header: true, skipEmptyLines: true});

	db.data.forEach((el) => {
		for (const key of Object.keys(el)) {
			el[key] = typificate(key, el[key]);
		}
	});

	return db.data;
}

async function saveToFile(table, {csv, headers}) {
	try {
		await Promise.all([
			fs.promises.writeFile(path.join(RASP_STORAGE, `${table}.csv`), csv),
			fs.promises.writeFile(
				path.join(RASP_STORAGE, `${table}.meta.json`),
				JSON.stringify(headers)
			)
		]);
	} catch (err) {
		console.error(err);
	}
}

async function loadFromFile(table, resolve, reject) {
	let csv;
	try {
		csv = await fs.promises.readFile(
			path.join(RASP_STORAGE, `${table}.csv`),
			'utf-8'
		);
	} catch (err) {
		console.error(err);
		return reject(err);
	}
	const data = parseCsv(csv);
	return resolve(data);
}

async function getData(db, table) {
	const metaFile = path.join(RASP_STORAGE, `${table}.meta.json`);
	const csvFile = path.join(RASP_STORAGE, `${table}.csv`);

	let meta;
	try {
		await fs.promises.stat(csvFile);
		meta = JSON.parse(await fs.promises.readFile(metaFile));
	} catch (err) {
		if (err.code !== 'ENOENT') throw err;
	}

	const headers = {};
	if (meta) {
		headers['if-modified-since'] = meta['last-modified'];
		headers['if-none-match'] = meta.etag;
	}

	const executor = (resolve, reject) => {
		https
			.get(URL_TEMPLATE.replace('{table}', table), {headers}, async (res) => {
				if (res.statusCode === 304) {
					if (db[table]) return resolve(null); // no need to update table;

					loadFromFile(table, resolve, reject);
					return;
				}

				if (res.statusCode !== 200) {
					console.error(`${res.statusCode} ${res.statusMessage}`);
					loadFromFile(table, resolve, reject);
					return;
				}

				let csv = '';

				res.on('data', (d) => {
					csv += d;
				});

				res.once('error', (err) => {
					console.error(err);
					loadFromFile(table, resolve, reject);
				});

				res.once('end', async () => {
					await saveToFile(table, {csv, headers: res.headers});

					const data = parseCsv(csv);
					resolve(data);
				});
			})
			.once('error', (err) => {
				console.error(err);
				loadFromFile(table, resolve, reject);
			});
	};

	return new Promise(executor);
}

function typificate(key, value) {
	if (typeof value !== 'string') return value;
	if (['KAUDI', 'NAIM', 'MEMO', 'FAMIO'].includes(key)) return value;

	if (/^\d+$/i.test(value)) return parseInt(value);
	if (/^(true|false)$/i.test(value))
		return {true: true, false: false}[value.toLowerCase()];

	const match = value.match(
		/^(\d{1,2})[.-/](\d{1,2})[.-/](\d{4})\s+(\d|[:])+$/
	);
	if (match)
		return new Date(
			`${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`
		);

	return value;
}

module.exports = download;
