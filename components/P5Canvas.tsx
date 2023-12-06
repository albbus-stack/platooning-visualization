import React, { useCallback, useContext, useEffect, useState } from "react";
import PageVisibility from "react-page-visibility";
import { SliverContext } from "./sliver/SliverProvider";
import { DataContext, DataType, GraphPoints } from "./DataProvider";
import { NextReactP5Wrapper } from "@p5-wrapper/next";
import { type Sketch, type SketchProps } from "@p5-wrapper/react";

type SimulationSketchProps = SketchProps & {
  carSpacing: number;
  carNumber: number;
  timeHeadway: number;
  leadingCarChart: GraphPoints[];
  sliverHeight: number;
  resetCanvas: (width: number, carNumber: number, carSpacing: number) => void;
  togglePlay: (isFailed: boolean) => void;
};

// Constants
const CAR_WIDTH = 100;
const ROAD_WIDTH = 150;
const ROAD_MARKER_WIDTH = 15;
const SCALE_FACTOR = 0.9;

// Simulation variables
let roadMarkerX = 0;
let secondRoadMarkerX = 0;
let oscillationY = 0;

let distance: number[] = [];
let velocity: number[] = [];
let acceleration: number[] = [];
let carPoints: number[] = [];

// Control variable & errors
let controlU: number[] = [];
let error: number[] = [];

// Previous velocity at time t-1
let prevV: number[] = [];
// Previous control at time t-1
let prevU: number[] = [];

// Control constants
let tau: number = 0.1;
let kp: number = 0.2;
let kd: number = 0.7;
const TS: number = 60;

// Timing variables
let timeTick = -1;
let intervalRef: NodeJS.Timeout;
let leadingCarChartIndex = 0;

// Play/Pause variables
let isPlaying = false;

const sketch: Sketch<SimulationSketchProps> = (p5) => {
  // Tracking variables
  let sliverHeight = 0;
  let carNumber = 0;
  let carSpacing = 0;
  let timeHeadway = 0;
  let leadingCarChart = [{} as { time: number; velocity: number }];

  // Initialize with mock function
  let resetCanvas = (w: number, n: number, s: number) => {};
  let togglePlay = (f: boolean) => {};
  let firstRender = true;

  // The p5.js setup function
  p5.setup = () => {
    if (!firstRender) {
      p5.createCanvas(window.innerWidth, window.innerHeight);
      resetCanvas(p5.width, carNumber, carSpacing);
      // for debugging
      //p5.frameRate(5);
    }
  };

  p5.updateWithProps = (props) => {
    // Reset the canvas if some of the settings change
    if (
      carSpacing !== props.carSpacing ||
      carNumber !== props.carNumber ||
      timeHeadway !== props.timeHeadway ||
      leadingCarChart !== props.leadingCarChart
    ) {
      props.resetCanvas(p5.width, props.carNumber, props.carSpacing);
    }
    carSpacing = props.carSpacing;
    carNumber = props.carNumber;
    timeHeadway = props.timeHeadway;
    leadingCarChart = props.leadingCarChart;

    // Assign the correct functions before running the actual setup
    resetCanvas = props.resetCanvas;
    togglePlay = props.togglePlay;
    if (firstRender) {
      firstRender = false;
      p5.setup();
    }

    // Resize the canvas if the sliver height changes
    if (sliverHeight !== props.sliverHeight)
      p5.resizeCanvas(
        window.innerWidth,
        window.innerHeight - props.sliverHeight
      );
    sliverHeight = props.sliverHeight;
  };

  // The p5.js draw function
  p5.draw = () => {
    // Center the coordinates
    p5.translate(0, p5.height / 2 + 15);

    // Road background
    const roadThird = ROAD_WIDTH / 3;
    p5.background(226, 232, 260);
    p5.fill(100, 116, 139);
    p5.rect(0, -roadThird, p5.width * 2, 2 * roadThird);

    // Scale all the next drawings
    p5.scale(SCALE_FACTOR, 1);

    // Moving road markings
    p5.fill(254);
    p5.rect(roadMarkerX, -roadThird, ROAD_MARKER_WIDTH, 2 * roadThird);
    p5.rect(secondRoadMarkerX, -roadThird, ROAD_MARKER_WIDTH, 2 * roadThird);

    if (isPlaying) {
      const delta = leadingCarChart[leadingCarChartIndex].velocity / 2;
      roadMarkerX -= delta;
      secondRoadMarkerX -= delta;
      if (roadMarkerX < -ROAD_MARKER_WIDTH) {
        roadMarkerX = p5.width * (2 - SCALE_FACTOR);
      }
      if (secondRoadMarkerX < -ROAD_MARKER_WIDTH) {
        secondRoadMarkerX = p5.width * (2 - SCALE_FACTOR);
      }
    }

    // Cars loop
    p5.textSize(16);
    for (let i = 0; i < carNumber; i++) {
      // Car illustration
      p5.fill(0);
      p5.rect(
        carPoints[i],
        -25 + Math.sin(oscillationY + i) * 1.5,
        CAR_WIDTH,
        50,
        5
      );

      // Car number
      p5.textAlign(p5.CENTER);
      p5.fill(255);
      p5.text(
        i + 1,
        carPoints[i] + CAR_WIDTH / 2,
        5 + Math.sin(oscillationY + i) * 1.5
      );

      // Distance calculation
      if (i !== carNumber - 1) {
        distance[i] = carPoints[i] - (carPoints[i + 1] + CAR_WIDTH);

        // Distance text
        p5.fill(0);
        p5.textAlign(p5.CENTER);
        p5.text(
          Math.round(distance[i]) / 10 + "m",
          (carPoints[i + 1] + CAR_WIDTH + carPoints[i]) / 2,
          -77
        );

        // The simulation fails if the distance between two cars is negative
        if (distance[i] < 0) {
          togglePlay(true);
        }

        // Distance indicators
        p5.fill(0);
        p5.line(
          carPoints[i + 1] + CAR_WIDTH,
          -70,
          carPoints[i + 1] + CAR_WIDTH,
          -50
        );
        p5.line(carPoints[i], -70, carPoints[i], -50);
        p5.line(carPoints[i + 1] + CAR_WIDTH, -60, carPoints[i], -60);
      }
    }

    // Don't compute any dynamic value if the simulation is paused or if the simulation failed
    if (!isPlaying) return;

    // Cycle through the leading car chart points once every second
    if (p5.frameCount % 60 === 0 && p5.frameCount !== 0) {
      leadingCarChartIndex++;
    }
    if (leadingCarChartIndex === leadingCarChart.length - 1) {
      leadingCarChartIndex = 0;
    }

    let platooningEquations: boolean = true;

    if (!platooningEquations) {
      // FIXME: This is a hacky way to approximate the platooning equations
      // Update car velocities and positions
      velocity[0] = leadingCarChart[leadingCarChartIndex].velocity / 10;
      for (let i = 1; i < carNumber; i++) {
        // Approximation that works well
        acceleration[i] =
            (-1 / timeHeadway) * (velocity[i - 1] - velocity[i]) +
            ((1 / timeHeadway) * (distance[i - 1] - distance[i])) / 10;
        velocity[i] = velocity[i - 1] + acceleration[i];
        carPoints[i] -= velocity[i - 1] - velocity[0];
      }
    } else {
      // Settings for the first car
      prevV[0] = velocity[0];
      prevU[0] = controlU[0];
      error[0] = 0;
      let v0 = velocity[0];
      acceleration[0] = (leadingCarChart[leadingCarChartIndex+1 % leadingCarChart.length].velocity - leadingCarChart[leadingCarChartIndex].velocity);
      velocity[0] += acceleration[0]/TS;
      //acceleration[0] = 0.01;
      //velocity[0] = velocity[0] + acceleration[0];

      controlU[0] = acceleration[0];
      const standstillDistance = carSpacing * 10 + CAR_WIDTH;

      // Update other cars settings
      for (let i = 1; i < carNumber; i++) {
        // Time i-1 (previous time): ei, vi, ai, ui
        let e = error[i];
        let a = -1 * acceleration[i];

        // Time i (actual time difference): Δei, Δvi, Δai, Δui
        error[i] += prevV[i - 1] - prevV[i] - timeHeadway * a;
        velocity[i] += a;
        acceleration[i] += (prevU[i] - a) / tau;
        controlU[i] += (kp * e - kd * prevV[i] - prevU[i] + kd * prevV[i - 1] + prevU[i - 1]) / timeHeadway - kd * a;

        // All values Δei, Δvi, Δai, Δui <- *= TS
        error[i] /= TS;
        velocity[i] /= TS;
        acceleration[i] /= TS;
        controlU[i] /= TS;

        // TODO: implement carPoints[i] // di = ei + ri(standstill distace) + vi*th(velocity of i vehicle * timeHeadway) - v0 (reference velocity)
        let desiredDistance = standstillDistance + velocity[i] * timeHeadway;
        let d: number = error[i] + desiredDistance;
        carPoints[i] = carPoints[i-1] - d;
        console.log("d: ", d, " of car ", i);

        // Update previous values
        prevV[i] = velocity[i];
        prevU[i] = controlU[i];
      }
      console.log("error: ", error, "\nvelocity: ", velocity, "\nacceleration: ", acceleration, "\ncontrolU: ", controlU, "\ncarPoints: ", carPoints, "\ndistance: ", distance);
    }
    oscillationY += 0.1;
  };
};

const P5Canvas: React.FC = () => {
  const {
    carNumber: carNumberSetting,
    setGraphData,
    carSpacing: carSpacingSetting,
    timeHeadway,
    leadingCarChart,
  } = useContext(DataContext);
  const { height, setIsSliverOpen, isSliverOpen, setIsGraphSliver } =
    useContext(SliverContext);

  const sliverHeight = isSliverOpen ? height : 0;

  const [isPlayingState, setIsPlayingState] = useState(isPlaying);

  // This function toggles the play/pause button and the interval
  const togglePlay = useCallback(
    (isFailed: boolean = false) => {
      if (isPlaying) {
        clearInterval(intervalRef);
        isPlaying = false;
        setIsPlayingState(isPlaying);
      } else if (!isFailed) {
        // This is the interval that updates the graph data
        intervalRef = setInterval(() => {
          timeTick++;
          setGraphData((car) => {
            if (car.length === 1) {
              let carList = [] as DataType[][];
              for (let i = 0; i < carNumberSetting; i++) {
                carList.push([]);
              }
              car = carList;
              return car;
            }

            return car.map((prev, i) => {
              return [
                ...prev,
                {
                  distance: distance[i],
                  velocity: velocity[i],
                  time: timeTick,
                },
              ];
            });
          });
        }, 1000);

        isPlaying = true;
        setIsPlayingState(isPlaying);
      }
    },
    [carNumberSetting, setGraphData]
  );

  // This function resets the canvas data
  const resetCanvas = (
    width: number,
    carNumber: number,
    carSpacing: number
  ) => {
    carPoints = [];
    distance = [];
    velocity = [];
    acceleration = [];
    prevU = [];
    prevV = [];
    controlU = [];
    error = [];

    const desiredDistance = carSpacing * 10 + CAR_WIDTH;
    const offset = width - CAR_WIDTH / 2;

    // Initialize cars
    for (let i = 0; i < carNumber; i++) {
      carPoints.push(offset - i * desiredDistance);
      distance.push(0);
      velocity.push(leadingCarChart[0].velocity);
      acceleration.push(0);
      error.push(0);
      controlU.push(0);
      prevV.push(leadingCarChart[0].velocity);
      prevU.push(0);
    }

    // Initialize road markings
    secondRoadMarkerX = width / 2;
    roadMarkerX = width + 100;

    // Initialize graph data
    setGraphData(() => {
      let carList = [] as {
        distance: number;
        velocity: number;
        time: number;
      }[][];
      for (let i = 0; i < carNumber; i++) {
        carList.push([]);
      }
      return carList;
    });

    timeTick = -1;
  };

  // This takes care of pausing when the page is not visible
  const onPageVisibilityChange = (isVisible: boolean) => {
    if (!isVisible) {
      clearInterval(intervalRef);
      isPlaying = false;
      setIsPlayingState(isPlaying);
    }
  };

  // This effect takes care of the keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        // Toggle the simulation
        togglePlay();
      } else if (e.key === "g") {
        // Open the graph sliver
        setIsGraphSliver((isGraph) => {
          setIsSliverOpen((isSliverOpen) => {
            if (!isGraph && isSliverOpen) {
              return true;
            } else {
              return !isSliverOpen;
            }
          });
          return true;
        });
      } else if (e.key === "s") {
        // Open the setting sliver
        setIsGraphSliver((isGraph) => {
          setIsSliverOpen((isSliverOpen) => {
            if (isGraph && isSliverOpen) {
              return true;
            } else {
              return !isSliverOpen;
            }
          });
          return false;
        });
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      // when setting are changed the simulation is stopped
      document.removeEventListener("keydown", onKeyDown);
      isPlaying = false;
      setIsPlayingState(isPlaying);
    };
  }, [setIsSliverOpen, setIsGraphSliver, togglePlay]);

  return (
    <PageVisibility onChange={onPageVisibilityChange}>
      <>
        <div className="p5-button" onClick={() => togglePlay()}>
          {!isPlayingState ? <PauseButton /> : <PlayButton />}
        </div>
        <NextReactP5Wrapper
          sketch={sketch}
          carSpacing={carSpacingSetting}
          carNumber={carNumberSetting}
          timeHeadway={timeHeadway}
          leadingCarChart={leadingCarChart}
          sliverHeight={sliverHeight}
          resetCanvas={resetCanvas}
          togglePlay={togglePlay}
        />
      </>
    </PageVisibility>
  );
};

const PauseButton = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="1.5"
      stroke="currentColor"
      className="w-7 h-7"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"
      />
    </svg>
  );
};

const PlayButton = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="1.5"
      stroke="currentColor"
      className="w-7 h-7"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 5.25v13.5m-7.5-13.5v13.5"
      />
    </svg>
  );
};

export default P5Canvas;
