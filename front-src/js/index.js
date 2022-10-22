import {
	loadEntities,
	loadClassesByDate,
	loadClassesBySubject
} from './lib/rasp-load.js';
import rasp from './pug/rasp.pug';

const filterForm = document.forms.filter;
const groupElement = document.getElementById('group');
const teacherElement = document.getElementById('teacher');
const roomElement = document.getElementById('room');
const oneDayElement = document.getElementById('oneDay');
const timetableElement = document.getElementById('timetable');

let period, groups, teachers, rooms;

const observerOptions = {
	root: timetableElement,
	rootMargin: '500px',
	threshold: 0
};

const observer = new IntersectionObserver((entries, observer) => {
	entries.forEach((entry) => {
		if (entry.isIntersecting) {
			const date = entry.target.dataset.date;

			const params = Object.fromEntries(
				['teacher', 'group', 'room'].map((key) => [key, filterForm[key].value])
			);

			(async () => {
				const classes = await loadClassesByDate(date, date, params);
				const data = {
					date,
					teacher: filterForm.teacher.value,
					group: filterForm.group.value,
					room: filterForm.room.value,
					teachers,
					groups,
					rooms,
					classes: classes.classesByDate[date]
				};
				const dateRaspHTML = rasp(data);
				const dateElement = timetableElement.querySelector(
					`[data-date="${date}"]`
				);
				dateElement.replaceWith(
					...(() => {
						const div = document.createElement('DIV');
						div.innerHTML = dateRaspHTML;
						return div.children;
					})()
				);
				observer.unobserve(entry.target);
			})();
		}
	});
}, observerOptions);

const workDate = (() => {
	const today = new Date();
	return `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
})();

filterForm.date.setAttribute('value', workDate);

(async () => {
	[period, groups, teachers, rooms] = await loadEntities([
		'period',
		'groups',
		'teachers',
		'rooms'
	]);

	groups.forEach((group) => groupElement.add(new Option(group)));
	teachers.forEach((teacher) => teacherElement.add(new Option(teacher)));
	rooms.forEach((room) => roomElement.add(new Option(room)));

	const filterForm = document.forms.filter;

	filterForm.addEventListener('change', async (event) => {
		const {name, value} = event.target;

		if (name === 'date' && !filterForm.oneDay.value) {
			const dateElement = timetableElement.querySelector(
				`[data-date="${value}"]`
			);
			dateElement?.scrollIntoView();
			return;
		}

		if (name !== 'date') {
			[groupElement, teacherElement, roomElement, oneDayElement].forEach(
				(el) => {
					if (el.name !== name) el.value = '';
				}
			);
		}

		timetableElement.innerHTML = '';

		if (filterForm.oneDay.value && (name === 'date' || name === 'oneDay')) {
			const date = filterForm.date.value;
			const subject = filterForm.oneDay.value;

			const classes = await loadClassesBySubject(date, subject);
			const subjectList = {groups, teachers, rooms}[subject];
			const subjectName = {
				teachers: 'teacher',
				groups: 'group',
				rooms: 'room'
			}[subject];

			timetableElement.innerHTML = '';
			subjectList.forEach((el) => {
				const data = {
					date,
					teacher: null,
					group: null,
					room: null,
					teachers,
					groups,
					rooms,
					classes: classes.classesBySubject[el],
					...{[subjectName]: el}
				};

				const dateRaspHTML = rasp(data);
				timetableElement.insertAdjacentHTML('beforeend', dateRaspHTML);
			});

			timetableElement.scrollTo(0, 0);

			return;
		}

		if (
			filterForm.group.value ||
			filterForm.teacher.value ||
			filterForm.room.value
		) {
			const dateFrom = new Date(
				new Date(filterForm.date.value).getTime() - 7 * 24 * 60 * 60 * 1000 // 7 days before
			)
				.toISOString()
				.slice(0, 10);
			const dateTo = new Date(
				new Date(filterForm.date.value).getTime() + 6 * 24 * 60 * 60 * 1000 // 6 days after
			)
				.toISOString()
				.slice(0, 10);

			const classes = await loadClassesByDate(dateFrom, dateTo, {
				[name]: value
			});

			const dates = [];
			let date = new Date(period.dateStart);
			const lastDate = new Date(period.dateEnd);
			while (date.getTime() <= lastDate.getTime()) {
				dates.push(date.toISOString().slice(0, 10));
				date = new Date(date.getTime() + 24 * 60 * 60 * 1000); // next date;
			}

			timetableElement.innerHTML = '';
			dates.forEach((date) => {
				const data = {
					date,
					teacher: filterForm.teacher.value,
					group: filterForm.group.value,
					room: filterForm.room.value,
					teachers,
					groups,
					rooms,
					classes: classes.classesByDate[date]
				};
				const dateRaspHTML = rasp(data);
				timetableElement.insertAdjacentHTML('beforeend', dateRaspHTML);
				if (new Date(date).getDay() === 0) {
					timetableElement.insertAdjacentHTML(
						'beforeend',
						`<div class="splitter"></div><article class="advertising">Advertising</article>`
					);
				}
			});

			const strDate = filterForm.date.value;
			const dateElement = timetableElement.querySelector(
				`[data-date="${strDate}"]`
			);

			dateElement?.scrollIntoView();

			timetableElement
				.querySelectorAll(`article.day-rasp[data-need-loading]`)
				.forEach((el) => {
					observer.observe(el);
				});
		}
	});
})();
