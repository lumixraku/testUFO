const times = [];
let fpsInSec = 0;
let loopStartTime = 0;
let refreshRateValue = 0;
let frameStartTime = -1;
let frameEndTime = -1;
let frameTimePrev = -1;
let timePeriodFromLastFrame = -1;
let inAFrame = (now) => {
  frameStartTime = now;
  if (frameStartTime != -1) {
    timePeriodFromLastFrame = frameStartTime - frameTimePrev;
  }
  frameTimePrev = frameStartTime;

  frameEndTime
  if (frameEndTime !== -1) {
    if (frameStartTime - frameEndTime >= 1000) {
      frameEndTime = frameStartTime;
      // Math.round(115/10) * 10
      console.log('!!!! refreshRateValue', refreshRateValue);
      refreshRateValue = 0;
    }
  } else {
    frameEndTime = frameStartTime;
    refreshRateValue = 0;
  }
  console.log('!!!! ME  refreshRateValue', refreshRateValue);
  refreshRateValue++;
}

let raq = () => {
  window.requestAnimationFrame(now => {
    inAFrame(now);
    raq();
  });
}


raq();
