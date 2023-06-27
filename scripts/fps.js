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
    if (this.length() === 0) return 0;
    const filterempty = this.arr.filter((x) => x);
    return filterempty.reduce((a, b) => a + b) / filterempty.length;
  };
}
const FRMAME_TIME_INIT = 0;

function MyFPS() {
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

  /**
   * 1s过后 本轮统计结束，开始下一轮统计
   */
  this.loopEndClear = () => {
    this.fpsLastSecond = this.frameCountInASecond;
    this.frameCountInASecond = 0;
    this.stutteringTimes = 0;
  };
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
        const avgFrameLatency = 1000 / this.fps();
        const jitter = Math.abs(this.timePeriodFromLastFrame - avgFrameLatency);
        if (jitter > avgFrameLatency / 2) {
          this.stutteringTimes++;
        }
        const rs = this.refreshRate();
        console.log(
          '!!!!+++ refreshRateValue------ME',
          rs,
          this.frameCountInASecond
        );

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

  this.fps = () => {
    return this.frameCountInASecond;
  };

  this.jankDetect = () => {

  };

  this.refreshRate = () => {
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
      const stableRefreshRate = this.findClosestValueInArray(
        COMMON_REFRESH_RATE,
        this.frameCountInASecond
      );
      this.detectedRefreshRate.newValue(stableRefreshRate);
      this.lastValidRefreshRate = stableRefreshRate;
      result = stableRefreshRate;
    } else if (bump) {

      const refreshRate = this.findClosestValueInArray(
        COMMON_REFRESH_RATE,
        this.frameCountInASecond
      );
      this.detectedRefreshRate.newValue(refreshRate);
      this.lastValidRefreshRate = refreshRate;

      result = 'bump';
    } else {
      result = this.getLastStableRefreshRate();
    }
    return result;
  };

  this.getLastStableRefreshRate = () => {
    // 不可以用均值，当刷新率变换的时候记录值可能是 [empty, 120, 120, 120, 60, 60, 60, 60]
    // 如用均值作为 refreshRate 则会得到 84Hz 这样的刷新率
    // return Math.round(this.detectedRefreshRate.avg());
    return 'last>>>>' + this.lastValidRefreshRate;
  };

  this.findClosestValueInArray = (arr, goal) => {
    const closest = arr.reduce(function (prev, curr) {
      return Math.abs(curr - goal) < Math.abs(prev - goal) ? curr : prev;
    });
    return closest;
  };
}
