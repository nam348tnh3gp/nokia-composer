class NokiaComposer {
  constructor(waveType = "sine", defaultTempo = 120) {
    this.playing = false;
    this.onStop = () => {};
    this.onNotePlaying = () => {};
    this.waveType = waveType;
    this.defaultTempo = defaultTempo;
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // Bảng tần số chuẩn (quãng 1 = Đô giữa C4 = 261.63Hz)
    this.freqTable = {
      'c': 261.63,  '#c': 277.18, 'd': 293.66, '#d': 311.13,
      'e': 329.63,  'f': 349.23,  '#f': 369.99, 'g': 392.00,
      '#g': 415.30, 'a': 440.00,  '#a': 466.16, 'b': 493.88
    };
    
    // Regex chuẩn Nokia: cho phép thiếu quãng tám (mặc định 1)
    // Nhóm: [độ dài][dấu chấm?][nốt/rest][quãng tám?]
    this.noteRegex = /^(\d+)(\.?)((?:[#]?[a-gA-G]|[-pPr]))([1-3])?$/;
  }

  setWaveType(type) {
    this.waveType = type;
  }

  // Parse chuỗi nhạc Nokia (các nốt cách nhau bằng space)
  parse(score) {
    const tokens = score.trim().split(/\s+/);
    const notes = [];
    let pos = 0;

    for (let token of tokens) {
      const match = this.noteRegex.exec(token);
      if (!match) {
        throw new Error(`Lỗi nốt: "${token}" - không đúng định dạng Nokia`);
      }

      let [, lenStr, dot, notePart, octaveStr] = match;
      
      // Độ dài nốt
      let length = 1 / parseInt(lenStr);
      if (dot === '.') length *= 1.5;  // dấu chấm đơn
      
      // Xác định tần số
      let frequency = 0;
      let isRest = /[-pPr]/i.test(notePart);
      
      if (!isRest) {
        // Chuẩn hóa tên nốt (chữ thường, đảm bảo dấu #)
        let noteName = notePart.toLowerCase();
        let baseFreq = this.freqTable[noteName];
        if (!baseFreq) {
          throw new Error(`Nốt không hợp lệ: "${notePart}"`);
        }
        // Quãng tám mặc định = 1 nếu không khai báo
        let octave = octaveStr ? parseInt(octaveStr) : 1;
        frequency = baseFreq * Math.pow(2, octave - 1);
      }
      
      notes.push({
        frequency,
        duration: 0,          // sẽ tính sau khi có tempo
        rawLength: length,
        token: token,
        isRest: isRest
      });
    }
    return notes;
  }

  // Phát nhạc với tempo (bpm = số nốt đen mỗi phút)
  play(score, tempo = null) {
    if (this.playing) return;
    const bpm = tempo || this.defaultTempo;
    const notes = this.parse(score);
    
    // Thời gian một nốt đen (ms)
    const quarterTime = 60000 / bpm;
    // Thời gian một nốt tròn = 4 nốt đen
    const wholeTime = quarterTime * 4;
    
    // Gán duration cho mỗi nốt (ms)
    for (let n of notes) {
      n.duration = n.rawLength * wholeTime;
    }
    
    this.playing = true;
    this.scheduleNotes(notes, 0);
  }

  scheduleNotes(notes, startIdx) {
    if (!this.playing || startIdx >= notes.length) {
      this.playing = false;
      this.onStop();
      return;
    }
    
    let currentTime = this.audioCtx.currentTime;
    let accumTime = currentTime;
    
    // Lập lịch từ nốt startIdx đến hết
    for (let i = startIdx; i < notes.length; i++) {
      const note = notes[i];
      const start = accumTime;
      const end = start + note.duration / 1000; // đổi ms -> giây
      
      if (!note.isRest) {
        const osc = this.audioCtx.createOscillator();
        osc.type = this.waveType;
        osc.frequency.value = note.frequency;
        osc.connect(this.audioCtx.destination);
        osc.start(start);
        osc.stop(end);
      }
      
      // Gọi callback khi nốt bắt đầu (dùng setTimeout đồng bộ UI)
      const timeoutId = setTimeout(() => {
        if (this.playing) {
          this.onNotePlaying(note.token, 0, 0);
        }
      }, (start - currentTime) * 1000);
      
      // Lưu timeout để có thể hủy khi stop
      note._timeout = timeoutId;
      accumTime = end;
    }
    
    // Lên lịch kết thúc sau nốt cuối
    const lastEnd = accumTime;
    this.endTimeout = setTimeout(() => {
      if (this.playing) {
        this.playing = false;
        this.onStop();
      }
    }, (lastEnd - currentTime) * 1000);
  }

  stop() {
    if (!this.playing) return;
    this.playing = false;
    // Hủy các timeout đã lên lịch
    if (this.endTimeout) clearTimeout(this.endTimeout);
    // AudioContext không thể hủy oscillator đã schedule, nhưng sẽ không phát thêm nữa
    // Đóng context cũ và tạo mới để dừng ngay lập tức
    this.audioCtx.close();
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.onStop();
  }
}

// Export (cho module hoặc global)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NokiaComposer;
} else {
  window.NokiaComposer = NokiaComposer;
}
