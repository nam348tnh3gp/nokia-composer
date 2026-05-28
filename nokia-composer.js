/*****
* Nokia Composer Class – fixed for original Nokia syntax
* by Faiz Ilham (modified)
*
* Hỗ trợ định dạng: "8#a1", "8,g1", "8f1", "8c2", v.v.
* Dấu phẩy (,) hoặc dấu chấm (.) đều là dotted note.
*****/

class NokiaComposer {
	constructor(waveType){
		this.playing = false;
		this.onStop = () => {};
		this.onNotePlaying = () => {};
		this.waveType = waveType || "sine";
		
		this.audio_ctx = new (window.AudioContext || window.webkitAudioContext)();
		
		// Regex sửa lại: bắt số, dấu phẩy/chấm, nốt (có #), octave (1-3) hoặc dấu nghỉ (-, p, P)
		this.note_pattern = /^(\d+)([.,]?)(?:(#?[a-gA-G])([1-3])|([\-pP]))$/;
		
		this.frequency_table = {
			"c": 261.63,
			"#c": 277.18,
			"d": 293.66,
			"#d": 311.13,
			"e": 329.63,
			"f": 349.23,
			"#f": 369.99,
			"g": 392,
			"#g": 415.3,
			"a": 440,
			"#a": 466.16,
			"b": 493.88
		};
	}
	
	setWaveType(waveType){
		this.waveType = waveType;
	}
	
	parse(text){
		let notes = text.trim().split(/\s+/);
		let pos = 0;
		
		let tunes = notes.map((note, idx) => {
			let start_pos = text.indexOf(note, pos);
			let end_pos = start_pos + note.length;
			pos = end_pos;
			
			let matches = this.note_pattern.exec(note);
			if (!matches) {
				throw {message: "Invalid note", token: note, start_pos, end_pos};
			}
			
			let [, length_portion, dot, base_note, octave, rest] = matches;
			
			// trường độ
			let length = 1 / parseInt(length_portion, 10);
			if (dot) length *= 1.5;   // dấu chấm hoặc dấu phẩy đều là dotted note
			
			let frequency = 0;
			if (base_note) {
				// chuẩn hóa tên nốt viết thường
				let noteName = base_note.toLowerCase();
				let freqBase = this.frequency_table[noteName];
				if (!freqBase) throw {message: "Unknown note", token: note};
				// Nokia: octave 1 = C4 (261.63) - nhân hệ số 2^(octave-1)
				frequency = freqBase * Math.pow(2, parseInt(octave,10) - 1);
			} else if (rest) {
				frequency = 0; // nghỉ
			}
			
			return {frequency, length, note, start_pos, end_pos};
		});
		
		return tunes;
	}
	
	playWave(waves, idx){
		if (idx === waves.length){
			this.playing = false;
			this.onStop();
			return;
		}
		
		let {oscillator, duration, note, start_pos, end_pos} = waves[idx];
		
		if (oscillator){
			// AudioContext cần được resume nếu chưa
			if (this.audio_ctx.state === "suspended") {
				this.audio_ctx.resume().then(() => oscillator.start());
			} else {
				oscillator.start();
			}
			this.currentOscillator = oscillator;
		} else {
			this.currentOscillator = null;
		}
		
		this.onNotePlaying(note, start_pos, end_pos);
		
		this.currentTask = setTimeout(() => {
			if (oscillator) oscillator.stop();
			this.playWave(waves, idx + 1);
		}, duration);
	}
	
	play(tunes, bpm){
		if (this.playing) return;
		this.playing = true;
		
		// Nếu AudioContext chưa active, resume (cần tương tác người dùng trước)
		if (this.audio_ctx.state === "suspended") {
			this.audio_ctx.resume().then(() => this._playInternal(tunes, bpm));
		} else {
			this._playInternal(tunes, bpm);
		}
	}
	
	_playInternal(tunes, bpm){
		let baseDuration = 60000 * 4 / bpm;
		
		let waves = tunes.map(({frequency, length, note, start_pos, end_pos}) => {
			let duration = Math.floor(length * baseDuration);
			let oscillator = null;
			if (frequency > 0){
				oscillator = this.audio_ctx.createOscillator();
				oscillator.type = this.waveType;
				oscillator.frequency.value = frequency;
				oscillator.connect(this.audio_ctx.destination);
			}
			return {duration, oscillator, note, start_pos, end_pos};
		});
		
		this.playWave(waves, 0);
	}
	
	stop(){
		if (!this.playing) return;
		try {
			if (this.currentTask) clearTimeout(this.currentTask);
			if (this.currentOscillator) this.currentOscillator.stop();
		} catch(e) {}
		this.playing = false;
		this.onStop();
	}
	
	// Tiện ích: parse + play chỉ với text và bpm
	loadAndPlay(text, bpm = 120) {
		try {
			const tunes = this.parse(text);
			this.play(tunes, bpm);
		} catch(e) {
			console.error(e);
		}
	}
}

// Export cho cả browser và Node
if (typeof module !== 'undefined' && module.exports) {
	module.exports = NokiaComposer;
}
