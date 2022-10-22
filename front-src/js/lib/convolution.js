function convolution(field, arr) {
	if (!Array.isArray(arr)) throw new Error();

	const resStage1 = cstage1(field, arr);
	const resStage2 = cstage2(resStage1);
	const resStage3 = cstage3(resStage2);

	return Object.fromEntries(resStage3);
}

function cstage1(field, arr) {
	const res = {};
	arr.forEach((row) => {
		const groupValue = row[field];
		if (!res[groupValue]) res[groupValue] = {...row};
		Object.entries(row).forEach(([key, value]) => {
			if (res[groupValue][key]?.toString() === '[object Set]') {
				res[groupValue][key].add(value);
				return;
			}
			res[groupValue][key] = new Set([res[groupValue][key]]);
			res[groupValue][key].add(value);
		});
	});
	return res;
}

function cstage2(resStage1) {
	return Object.entries(resStage1).map(([groupValue, row]) => {
		const newGroupValue =
			groupValue === '0' || groupValue === '1' ? groupValue : '2';
		return [newGroupValue, row];
	});
}

function cstage3(resStage2) {
	return resStage2.map(([groupValue, row]) => {
		const newRow = Object.fromEntries(
			Object.entries(row).map(([key, value]) => {
				let newValue;
				if (value?.toString() === '[object Set]') {
					newValue = Array.from(value);
					if (newValue.length === 1) newValue = newValue[0];
				} else {
					newValue = value;
				}

				return [key, newValue];
			})
		);

		return [groupValue, newRow];
	});
}

export default convolution;
