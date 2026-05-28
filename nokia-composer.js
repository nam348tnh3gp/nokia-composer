/*****
* Nokia Composer Class (chỉnh sửa để giống máy Nokia thật)
* by Faiz Ilham & sửa bởi trợ lý
*
* Điểm khác biệt:
* - Âm thanh mặc định là "square" thay vì "sine"
* - Tự động bỏ qua dấu phẩy trong chuỗi nhập (ví dụ "8,g1" -> "8 g1")
* - Giữ nguyên cú pháp nốt: 8#a1, 8g1, 4p, v.v.
*****/

class NokiaComposer {
	constructor(waveType){
		/*** init defaults ***/
		this.playing = false;
		this.onStop = () => {};
		this.onNotePlaying = () => {};
		// SỬA: mặc định dùng "square" cho âm thanh giống Nokia
		this.waveType = waveType || "square";
		
		/*** init AudioContext and constants ***/
		this.audio_ctx = new (window.AudioContext || window.webkitAudioContext)();
		// SỬA: regex cho phép dấu phẩy, dấu chấm, và cả rest
		this.note_pattern = /^(\d+)(\.?)(?:(#?[acdfgACDFG]|[beBE])([1-3])|([\-pP]))$/;
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
		// SỬA: thay thế dấu phẩy bằng khoảng trắng (hỗ trợ nhập kiểu "8,g1")
		text = text.replace(/,/g, ' ');
		// trim and split by spaces
		let notes = text.trim().split(/\s+/);		
		let pos = 0;
		
		let tunes = notes.map((note, idx) => {
			let matches = this.note_pattern.exec(note);
			
			// get note's start & end position in the original text
			let start_pos = text.indexOf(note, pos);
			let end_pos = start_pos + note.length;
			
			if (!matches) {
				throw {message: "Invalid note", token: note, start_pos, end_pos};
			}
			
			pos = end_pos;
			
			let [, length_portion, halfdot, base_note, octave, rest] = matches;
			
			// parse note length
			let length = 1 / length_portion;
			if (halfdot) length *= 1.5;
			
			// parse frequency based on note and octave, rest notes = 0
			let frequency = 0;
			
			if (base_note){
				frequency = this.frequency_table[base_note.toLowerCase()] * (1 << (octave - 1));
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
			oscillator.start();
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
		
		this.baseDuration = 60000 * 4 / bpm;
		
		let waves = tunes.map( ({frequency, length, note, start_pos, end_pos}) => {
			let duration = Math.floor(length * this.baseDuration);
			
			let oscillator;
			if (frequency){
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
};

(function () {
	if (typeof module !== 'undefined' && module.exports) {
		module.exports = NokiaComposer;
	}
})();
