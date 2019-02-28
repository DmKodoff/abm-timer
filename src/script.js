((win, doc) => {
    const timeURL = 'https://api.worldwideshop.ru/time/get/';

    let loadedTime = (new Date()).getTime();
    let loadedLocalTime = loadedTime;

    // 0: неизвестно, 1: загружено, -1: ошибка загрузки
    let APIState = 0;

    // массив со всеми объектами таймеров
	const timers = [];

	const setDataAll = () => {
	    for (let i = 0; i < timers.length; i++) {
            timers[i].setData();
        }
    };

	const newElement = (parentElement, className) => {
		const element = doc.createElement('div');
		element.className = className;
		parentElement.appendChild(element);
		return element;
	};

	const declOfNum = (number, titles) => {
        const cases = [2, 0, 1, 1, 1, 2];
        return titles[
            (number % 100 > 4 && number % 100 < 20) ? 2 : cases[(number % 10 < 5) ? number % 10 : 5]
        ];
    };

    const http = new XMLHttpRequest();
    http.onreadystatechange = () => {
        if (http.readyState === 4 && http.status === 200){
            const data = http.responseText;
            try {
                const parsed = JSON.parse(data);
                if (parsed.time) {
                    loadedTime = parsed.time * 1000;
                    loadedLocalTime = (new Date()).getTime();
                    APIState = 1;
                } else {
                    APIState = -1;
                }
            } catch (e) {
                APIState = -1;
            }
            setDataAll();
        }
    };
    http.onerror = () => {
        APIState = -1;
        setDataAll();
    };
    http.open('GET', timeURL, true);
    http.send();

    // если через секунду не получили дату с API, то берём её с клиента
    setTimeout(() => {
        if (APIState === 0) {
            APIState = -1;
            setDataAll();
        }
    }, 1000);

	class Timer {
		element = null;
		childrenElements = {};
		dataInitialized = false;
		zeroInitialized = true;

        constructor (element) {
            this.element = element;

            this.build();
            this.tick();
        }

        build () {
            // getting attrs
            let starts = this.element.getAttribute('data-starts') || '* 0';
            starts = starts.split(' ');
            starts[0] = starts[0] === '*' ? '*' : parseInt(starts[0]);
            starts[1] = parseInt(starts[1]);
            this.starts = starts;

            this.interval = eval(this.element.getAttribute('data-interval') || 24);

            this.duration = parseInt(this.element.getAttribute('data-duration') || 0);

            this.c1text = this.element.getAttribute('data-c1') || '';
            this.c2text = this.element.getAttribute('data-c2') || '';
            this.c3text = this.element.getAttribute('data-c3') || '';

            const days = this.element.getAttribute('data-days');
            this.showDays = days === 'yes' || days === 'true' || days === '1';

            const reload = this.element.getAttribute('data-reload');
            this.reload = reload === 'yes' || reload === 'true' || reload === '1';

            this.redirect = this.element.getAttribute('data-redirect');

            // constructing the body
            const c0 = newElement(this.element, '__abm_timer_c0');
            this.childrenElements['c0'] = c0;
            const c1 = newElement(c0, '__abm_timer_c1');
            this.childrenElements['c1'] = c1;
            c1.innerHTML = this.c1text ? '...' : '';
            const c2 = newElement(c0, '__abm_timer_c2');
            this.childrenElements['c2'] = c2;
            c2.innerHTML = this.c2text ? '...' : '';
            const c3 = newElement(c0, '__abm_timer_c3');
            this.childrenElements['c3'] = c3;
            c3.innerHTML = this.c3text ? '...' : '';
            const b0 = newElement(this.element, '__abm_timer_b0');
            this.childrenElements['b0'] = b0;
            for (let j = 0; j <= 3; j++) {
                const b1 = newElement(b0, '__abm_timer_b1');
                if (!this.showDays && j === 0) {
                    b1.style.display = 'none';
                }
                this.childrenElements['b1_' + j] = b1;
                const b2 = newElement(b1, '__abm_timer_b2');
                this.childrenElements['b2_' + j] = b2;
                this.childrenElements['label_' + j] = newElement(b1, '__abm_timer_b3');
                this.childrenElements['d_' + j + '_1'] = newElement(b2, '__abm_timer_b4');
                this.childrenElements['d_' + j + '_2'] = newElement(b2, '__abm_timer_b4');
            }

            // setting the done flag
            this.element.setAttribute('data-init', '1');
        }

        setData () {
            const date = new Date(loadedTime);
            let starts = [
                this.starts[0],
                this.starts[1],
            ];
            const nd = date.getUTCDay();
            const nh = date.getUTCHours();
            if (starts[0] === '*') {
                if (nh < starts[1]) {
                    starts[0] = nd - 1;
                    starts[0] += starts[0] < 0 ? 7 : 0;
                } else {
                    starts[0] = nd;
                }
            } else {
                starts[0] = parseInt(starts[0]);
                if (starts[0] === 7) {
                    starts[0] = 0;
                }
            }
            let daysOffset = nd - starts[0];
            daysOffset += daysOffset < 0 ? 7 : 0;
            if (daysOffset === 0) {
                if (nh < starts[1]) {
                    daysOffset += 7;
                }
            }
            const hoursOffset = nh - starts[1];
            let started = daysOffset * 24 * 3600 + hoursOffset * 3600;
            started += date.getUTCMinutes() * 60;
            started += date.getUTCSeconds();

            this.time_left = this.interval - started;

            let d;
            const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
            d = new Date(this.time_left * 1000 + loadedTime + 3 * 3600000);
            const d1 = d.getUTCDate();
            const m1 = months[d.getUTCMonth()];
            d = new Date(this.time_left * 1000 + loadedTime + 3 * 3600000 + 24 * this.duration * 3600000);
            const d2 = d.getUTCDate();
            const m2 = months[d.getUTCMonth()];
            const f = (s) => {
                s = s.replace(/%d1/g, d1);
                s = s.replace(/%d2/g, d2);
                s = s.replace(/%m1/g, m1);
                s = s.replace(/%m2/g, m2);
                s = s.replace(/{/g, '<span>');
                s = s.replace(/}/g, '</span>');
                return s;
            };
            this.childrenElements['c1'].innerHTML = f(this.c1text);
            this.childrenElements['c2'].innerHTML = f(this.c2text);
            this.childrenElements['c3'].innerHTML = f(this.c3text);

            const wasInitialized = this.dataInitialized;
            this.dataInitialized = true;
            if (!wasInitialized) {
                this.update();
            }
        }

        update () {
            let time_left = this.dataInitialized ? this.time_left : 0;

            const timePassed = Math.floor(((new Date()).getTime() - loadedLocalTime) / 1000);
            time_left -= timePassed;

            if (time_left < 0) {
                time_left = 0;
            }

            let remains = time_left;
            let days = Math.floor(remains / (3600 * 24));
            remains -= days * (3600 * 24);
            let hours = Math.floor(remains / 3600);
            remains -= hours * 3600;
            let minutes = Math.floor(remains / 60);
            remains -= minutes * 60;
            let seconds = remains;

            const days_label = this.dataInitialized ? declOfNum(days, ['день', 'дня', 'дней']) : '...';
            const hours_label = this.dataInitialized ? declOfNum(hours, ['час', 'часа', 'часов']) : '...';
            const minutes_label = this.dataInitialized ? declOfNum(minutes, ['минута', 'минуты', 'минут']) : '...';
            const seconds_label = this.dataInitialized ? declOfNum(seconds, ['секунда', 'секунды', 'секунд']) : '...';

            days = ('0' + days).substr(-2);
            hours = ('0' + hours).substr(-2);
            minutes = ('0' + minutes).substr(-2);
            seconds = ('0' + seconds).substr(-2);

            this.childrenElements['d_0_1'].innerHTML = this.dataInitialized ? days[0] : '';
            this.childrenElements['d_0_2'].innerHTML = this.dataInitialized ? days[1] : '';
            this.childrenElements['d_1_1'].innerHTML = this.dataInitialized ? hours[0] : '';
            this.childrenElements['d_1_2'].innerHTML = this.dataInitialized ? hours[1] : '';
            this.childrenElements['d_2_1'].innerHTML = this.dataInitialized ? minutes[0] : '';
            this.childrenElements['d_2_2'].innerHTML = this.dataInitialized ? minutes[1] : '';
            this.childrenElements['d_3_1'].innerHTML = this.dataInitialized ? seconds[0] : '';
            this.childrenElements['d_3_2'].innerHTML = this.dataInitialized ? seconds[1] : '';

            this.childrenElements['label_0'].innerHTML = days_label;
            this.childrenElements['label_1'].innerHTML = hours_label;
            this.childrenElements['label_2'].innerHTML = minutes_label;
            this.childrenElements['label_3'].innerHTML = seconds_label;

            if (time_left > 0 && APIState !== 0) {
                this.zeroInitialized = false;
            }

            return time_left;
        }

        tick () {
            const time_left = this.update();

            if (time_left > 0 || this.dataInitialized === false || APIState === 0) {
                setTimeout(() => {
                    this.tick();
                }, 500);
            } else {
                if ((this.reload || this.redirect) && this.zeroInitialized === false) {
                    if (this.reload) {
                        doc.location.reload();
                    } else {
                        doc.location.href = this.redirect;
                    }
                }
            }
        }
    }

    const initAllTimers = () => {
        const timerElements = doc.querySelectorAll('.__abm_timer');
        for (let i = 0; i < timerElements.length; i++) {
            const init = timerElements[i].getAttribute('data-init');
            if (!init) {
                timers.push(new Timer(timerElements[i]));
            }
        }
        if (APIState !== 0) {
            setDataAll();
        }
    };
    initAllTimers();

    // экспортируем функцию для динамического создания таймеров
    win.abmTimerInitAll = initAllTimers;
})(window, document);
