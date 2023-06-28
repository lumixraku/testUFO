const COMMON_REFRESH_RATE = [
  60, 75, 90, 100, 120, 144, 165, 200, 240, 300, 360, 480,
];
function CircularArray(size) {
  this.size = size;
  this.arr = [];
  this.index = 0;
  this.rawIndex = 0;
  this.newValue = (v) => {
    this.rawIndex++;
    this.index = this.rawIndex % this.size;
    this.arr[this.index] = v;
  };
  this.recentValue = (count) => {
    if (count <= 0) count = 1;
    let resultArr = [];

    if (this.index - count + 1 >= 0) {
      resultArr = this.arr.slice(this.index - count + 1, this.index + 1);
    } else {
      resultArr = [
        ...this.arr.slice(this.index - count + 1),
        ...this.arr.slice(0, this.index + 1),
      ];
    }
    if (resultArr.length === 0) resultArr = [0];
    return resultArr;
  };
  this.length = () => {
    return this.arr.length;
  };
  this.avg = () => {
    const filterempty = this.arr.filter((x) => x);
    return filterempty.reduce((a, b) => a + b, 0) / filterempty.length;
  };
}
const FRMAME_TIME_INIT = 0;
const STATE_NORMAL = 0;
const STATE_BUMP = 1;
const STATE_STUTTER = 2;

function MyFPS() {
  this.state =
  this.times = [];
  this.fpsInSec = 0;
  this.loopStartTime = 0;
  this.frameCountInASecond = 0;
  this.frameTime = FRMAME_TIME_INIT;
  this.lastRecordingTime = this.frameTime;
  this.frameCountLoopEndTime = FRMAME_TIME_INIT;
  this.frameTimePrev = FRMAME_TIME_INIT;
  this.timePeriodFromLastFrame = -1;
  // this.recordingFrameArray = []; // 1024 // circular array
  this.recordingFrameArray = new CircularArray(1024);
  this.stutteringTimes = 0;
  // this.recordingFrameArrayIndex = 0;
  // this.recordingLength = 1024;
  this.raqCount = 0;

  this.detectedRefreshRate = new CircularArray(10); // 记录已经测得的刷新率 用于 lookBehind 定位
  this.lastValidRefreshRate = 0; // 上一次稳定的刷新率
  this.fpsLastSecond = 0; // 上一次统计得到的 FPS 情况

  this.tickStartTime =  0;
  this.tickEnd = 0;

  /**
   * 1s过后 本轮统计结束，开始下一轮统计
   */
  this.loopEndClear = () => {
    this.fpsLastSecond = this.frameCountInASecond;
    this.frameCountInASecond = 0;
    this.stutteringTimes = 0;
    this.tickTimeArray = [];
  };


  this.tickTimeArray = [];
  this.tickStart = () => {
    this.tickStartTime = performance.now();
  }
  this.tickEnd = () => {
    this.tickEndTime = performance.now();
    this.tickTimeArray.push(this.tickEndTime - this.tickStartTime);
  }

  this.taskInAFrame = (now) => {
    this.frameTime = now;
    this.raqCount++;


    if (this.frameTime !== -1 && this.frameTimePrev !== -1) {
      this.timePeriodFromLastFrame = this.frameTime - this.frameTimePrev;
    }

    this.recordingFrameArray.newValue(this.timePeriodFromLastFrame);

    if (this.frameCountLoopEndTime !== FRMAME_TIME_INIT) {
      // if page paused, debugger or switch to another tab and then coming back
      if (this.frameTime - this.frameCountLoopEndTime >= 1500) {
        // paused!!!
        this.frameCountLoopEndTime = this.frameTime;
        this.loopEndClear();
      } else if (this.frameTime - this.frameCountLoopEndTime >= 1000) {
        const avgFrameLatency = 1000 / this.currFPSValue();
        const jitter = Math.abs(this.timePeriodFromLastFrame - avgFrameLatency);
        if (jitter > avgFrameLatency / 2) {
          this.stutteringTimes++;
        }

        const fpsInfo = this.recordFPS();
        const refreshRate = this.getRefreshRate();
        console.log(`!!!!+++ ------ME  rr: ${refreshRate}  fps: ${this.frameCountInASecond}, frameTime ${this.frameTime}  ${this.frameCountLoopEndTime} more:`, fpsInfo);

        this.frameCountLoopEndTime += 1000;
        this.loopEndClear();
      }

      // this.lastRecordingTime = this.frameTime;
    } else {
      // init frameEndTime
      this.frameCountLoopEndTime = this.frameTime;
    }
    this.frameCountInASecond++;
    this.frameTimePrev = this.frameTime;
  }; // end inAFrame

  this.currFPSValue = () => {
    return this.frameCountInASecond;
  };

  this.recordingFPSArray = []; // 累积记录多少秒数据呢? // 先不限制吧
  this.recordFPS = ()=> {
    const refreshRate = this.getRefreshRate();
    let lagTickTimes = 0;
    let continueLagTicks = 0; // over 1 frame latency
    let maxContinueLagTicks = 0;
    if(!isNaN(refreshRate)) {
      const frametime = 1000 / refreshRate;
      for (let i = 0; i < this.tickTimeArray.length - 1; i++) {
        const lastTickTime = i > 0 ? this.tickTimeArray[i - 1] : 0;
        const currentTickTime = this.tickTimeArray[i];
        const nextTickTime = this.tickTimeArray.length - 1 ? 0 : this.tickTimeArray[i + 1]; this.tickTimeArray[i + 1];
        if ( lastTickTime < frametime &&  currentTickTime > frametime) {
          lagTickTimes++;
        }
        if ((lastTickTime > frametime && currentTickTime > frametime) && // 连续两帧都是 lag
        (i == 0 && currentTickTime > frametime)) { // 第一帧就是 lag
          continueLagTicks++;
          if(continueLagTicks > maxContinueLagTicks) maxContinueLagTicks = continueLagTicks;
        }
        if(currentTickTime <= frametime ) continueLagTicks = 0;
      }
    }
    const fps = this.frameCountInASecond;
    const maxTickTime = Math.max(...this.tickTimeArray);
    const minTickTime = Math.min(...this.tickTimeArray);
    const avgTickTime = this.tickTimeArray.reduce((a, b) => a + b, 0) / this.tickTimeArray.length;
    const recentFrames = this.recordingFrameArray.recentValue(fps);
    const maxFrameTime = Math.max(...recentFrames);
    const minFrameTime = Math.min(...recentFrames);
    // 刷新率 - 实际帧数
    // 当进入 bump 状态时， 刷新率在波动中，此刻刷新率变化较大
    const dropFrames = Math.max(0, refreshRate - this.tickTimeArray.length);
    const fpsInfo = {
      fps,
      maxTickTime,
      minTickTime,
      avgTickTime,
      lagTickTimes,
      maxContinueLagTicks,
      dropFrames,
      maxFrameTime,
      minFrameTime,
    };
    this.recordingFPSArray.push(fpsInfo);
    return fpsInfo;
  }


  this.jankDetect = () => {

  };

  this.getRefreshRate = () => {
    // Math.round(115/10) * 10
    // const longframe = this.recordingFrameArray.slice(-120).some(t => t > 120) || this.recordingFrameArray.slice(-3).some(t => t > 300);
    let lookBehind = this.detectedRefreshRate.recentValue(1)[0] || 60;
    const avgRefreshRate = this.detectedRefreshRate.avg();
    const recentFrames = this.recordingFrameArray.recentValue(lookBehind);
    // const recent3Frames = this.recordingFrameArray.recentValue(3);

    // 不同场景对 longframe 定义不一样，refreshRate 要求比较高
    const longframe = recentFrames.some((t) => t > this.avgFrameLatency * 3);
    const jitterFrameLatency =
      Math.max(...recentFrames) - Math.min(...recentFrames) > 1; // 波动大于1 不认可

    const lag = this.stutteringTimes > 1;
    const tooLow = this.frameCountInASecond <= 15;

    // 微小抖动
    const jitterFPS =
      avgRefreshRate !== 0
        ? Math.abs(this.frameCountInASecond - avgRefreshRate) <= 1
        : false;

    // fps 大变化 当前帧和上一帧相比
    const bump =
      avgRefreshRate !== 0
        ? Math.abs(this.frameCountInASecond - this.fpsLastSecond) >= 10
        : false;

    let stableFrameLatency = !(
      longframe ||
      jitterFrameLatency ||
      tooLow ||
      lag ||
      bump
    );

    let result;
    if (stableFrameLatency) {
      const stableRefreshRate = this.findClosestSpecValueInArray(
        COMMON_REFRESH_RATE,
        this.frameCountInASecond
      );
      this.detectedRefreshRate.newValue(stableRefreshRate);
      this.lastValidRefreshRate = stableRefreshRate;
      result = stableRefreshRate;
    } else {

      if (bump) {
        const refreshRate = this.findClosestSpecValueInArray(
          COMMON_REFRESH_RATE,
          this.frameCountInASecond
        );
        this.detectedRefreshRate.newValue(refreshRate);
        if (this.lastValidRefreshRate === 0) this.lastValidRefreshRate = refreshRate;
        result = this.lastValidRefreshRate;//60;//'bump';
      } else {
        if (this.lastValidRefreshRate === 0) this.lastValidRefreshRate = 60;
        result = this.getLastStableRefreshRate();
      }
    }
    return result;
  };

  this.getLastStableRefreshRate = () => {
    // 不可以用均值，当刷新率变换的时候记录值可能是 [empty, 120, 120, 120, 60, 60, 60, 60]
    // 如用均值作为 refreshRate 则会得到 84Hz 这样的刷新率
    // return Math.round(this.detectedRefreshRate.avg());
    return this.lastValidRefreshRate === 0 ? 60 : this.lastValidRefreshRate;
    // return 'last>>>>' + this.lastValidRefreshRate;
  };

  this.findClosestValueInArray = (arr, goal) => {
    const closest = arr.reduce(function (prev, curr) {
      return Math.abs(curr - goal) < Math.abs(prev - goal) ? curr : prev;
    });
    return closest;
  };

  //
  this.findClosestSpecValueInArray = (arr, goal) => {
    const closest = arr.reduce(function (prev, curr) {
      // return Math.abs(curr - goal) < Math.abs(prev - goal) ? curr : prev;
      return goal - 5 > prev ? curr : prev;
    });
    return closest;
  };
}

window.startFPS = () => {
  const meme = new MyFPS();
  let lastT;
  const raf = (now) => {
    meme.tickStart();

    // lastT && document.querySelector('#lotsOfChildren').removeChild(lastT);
    // lastT = document.createElement('div');
    // document.querySelector('#lotsOfChildren').appendChild(lastT);
    const container = document.querySelector('#lotsOfChildren');

    const ran = performance.now() % 10000;
    let i = 0;
    while (i++ < ran) {
      const t = document.createElement('div');
      container.appendChild(t);
    }
    if(container.childElementCount > 10000) {
      container.innerHTML = ''
    }

    meme.tickEnd();
    meme.taskInAFrame(now);
    window.requestAnimationFrame(raf);
  };
  window.requestAnimationFrame(raf);
}
startFPS();