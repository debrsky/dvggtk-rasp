function makeRasp(tables, db, rasp) {
	const uroki = tables[0][0];
	rasp.data = {};
	rasp.data[uroki] = db[uroki];

	const sps = tables.slice(1);
	const usedIds = {};
	sps.forEach(([sp]) => {
		usedIds[sp] = new Set();
	});

	rasp.data[uroki].forEach((row) => {
		sps.forEach(([sp, idField]) => {
			usedIds[sp].add(row[idField]);
		});
	});

	sps.forEach(([sp, idField]) => {
		const data = db[sp];
		if (data) {
			rasp.data[sp] = data.reduce((prev, cur) => {
				const idValue = cur[idField];
				if (usedIds[sp].has(idValue)) prev[idValue] = cur;

				return prev;
			}, {});
		}
	});
}

module.exports = makeRasp;
