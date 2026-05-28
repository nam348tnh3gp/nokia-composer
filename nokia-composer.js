/*****
* Nokia Composer Class (fixed for Nokia format)
* by Faiz Ilham – fixed by assistant
*
* Supports: duration + optional dot + [note + octave] or rest 'p'
* Example: "8#a1 8.g1 4c2 2p"
*****/

class NokiaComposer {
	constructor(waveType){
		this.playing = false;
		this.onStop = () => {};
		this.onNotePlaying = () => {};
		this.waveType = waveType || "sine";
		
		this.audio_ctx = new (window.AudioContext || window.webkitAudioContext)();
		
		// Fixed regex: captures duration, dot, note (with optional #), octave, or rest 'p'
		this.note_pattern = /^(\d+)(\.?)(?:([#]?[a-gA-G])([1-3])|([pP]))$/;
		
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
		let tunes = [];
		
		for (let note of notes) {
			let start_pos = text.indexOf(note, pos);
			let end_pos = start_pos + note.length;
			pos = end_pos;
			
			let matches = this.note_pattern.exec(note);
			if (!matches) {
				throw {message: "Invalid note", token: note, start_pos, end_pos};
			}
			
			let [, length_portion, dot, base_note, octave, rest] = matches;
			
			// note length (1 = whole, 2 = half, 4 = quarter, 8 = eighth, etc.)
			let length = 1 / parseInt(length_portion, 10);
			if (dot === '.') length *= 1.5;
			
			let frequency = 0;
			if (!rest) {
				let key = base_note.toLowerCase(); // e.g. "#a" or "a"
				let freq = this.frequency_table[key];
				if (!freq) {
					throw {message: "Unknown note", token: note, start_pos, end_pos};
				}
				frequency = freq * (1 << (parseInt(octave, 10) - 1));
			}
			
			tunes.push({frequency, length, note, start_pos, end_pos});
		}
		
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
		
		// base duration of a whole note in milliseconds
		this.baseDuration = 60000 * 4 / bpm;
		
		let waves = tunes.map(({frequency, length, note, start_pos, end_pos}) => {
			let duration = Math.floor(length * this.baseDuration);
			let oscillator = null;
			if (frequency) {
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
	
	// Helper: resume AudioContext (required by browsers)
	async resumeContext() {
		if (this.audio_ctx.state === 'suspended') {
			await this.audio_ctx.resume();
		}
	}
}

// Export for Node.js or browser
if (typeof module !== 'undefined' && module.exports) {
	module.exports = NokiaComposer;
}
