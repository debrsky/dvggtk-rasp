function makeRasp(tables, db, rasp) {
	const uroki = tables[0][0];
	rasp.data = {};
	rasp.data[uroki] = db[uroki].filter((row) => row.IDR === 0);

	let dateStart = null;
	let dateEnd = null;
	rasp.data[uroki].forEach((row) => {
		if (dateStart === null || dateStart > row.DAT) dateStart = row.DAT;
		if (dateEnd === null || dateEnd < row.DAT) dateEnd = row.DAT;
	});
	rasp.dateStart = dateStart;
	rasp.dateEnd = dateEnd;
	rasp.maxUR = rasp.data[uroki].reduce(
		(prev, cur) => (prev < cur.UR ? cur.UR : prev),
		0
	);

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

	sps.forEach(([sp, idField, nameField]) => {
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
