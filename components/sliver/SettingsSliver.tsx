import { useContext } from "react";
import { DataContext } from "../DataProvider";
import { Line } from "react-chartjs-2";

import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from "chart.js";

import * as m from "../../src/paraglide/messages";

// @ts-ignore
import * as DragPlugin from "chartjs-plugin-dragdata";
import { SliverContext } from "./SliverProvider";
import { FRAME_RATE } from "../P5Canvas";

// Register the chart.js plugins
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  DragPlugin
);

const MAX_VELOCITY = 35;

const SettingsSliver = () => {
  const {
    carNumber,
    setCarNumber,
    carSpacing,
    setCarSpacing,
    timeHeadway,
    setTimeHeadway,
    tau,
    setTau,
    kp,
    setKp,
    kd,
    setKd,
    velocityFrameDelay,
    setVelocityFrameDelay,
    leadingCarChart,
    setLeadingCarChart,
  } = useContext(DataContext);

  const { size } = useContext(SliverContext);

  const computedGap = size === "S" ? "gap-0" : size === "M" ? "gap-2" : "gap-5";

  return (
    <>
      <section
        className={
          "flex flex-col items-center justify-center w-full h-full text-lg " +
          computedGap
        }
      >
        <div className="flex flex-row items-center w-full gap-10 px-10">
          <p className="text-center w-28 leading-[1.25rem]">{m.carNumber()}</p>
          <input
            type="range"
            min="2"
            max="10"
            value={carNumber}
            onChange={(e) => setCarNumber(parseInt(e.target.value))}
            className="w-1/2 p-1 transition-colors duration-300 cursor-pointer accent-slate-800 hover:accent-slate-700"
          />
          <p className="w-10 font-bold text-center">{carNumber}</p>
        </div>

        <div className="flex flex-row items-center w-full gap-10 px-10">
          <p className="text-center w-28 leading-[1.25rem]">{m.carSpacing()}</p>
          <input
            type="range"
            step="0.1"
            min="2"
            max="20.0"
            value={carSpacing}
            onChange={(e) => setCarSpacing(parseFloat(e.target.value))}
            className="w-1/2 p-1 transition-colors duration-300 cursor-pointer accent-slate-800 hover:accent-slate-700"
          />
          <p className="w-10 font-bold text-center">{carSpacing}m</p>
        </div>

        <div className="flex flex-row items-center w-full gap-10 px-10">
          <p className="text-center w-28 leading-[1.25rem]">
            {m.timeHeadway()}
          </p>
          <input
            type="range"
            step="0.01"
            min="0.01"
            max="2"
            value={timeHeadway}
            onChange={(e) => setTimeHeadway(parseFloat(e.target.value))}
            className="w-1/2 p-1 transition-colors duration-300 cursor-pointer accent-slate-800 hover:accent-slate-700"
          />
          <p className="w-10 font-bold text-center">{timeHeadway}s</p>
        </div>

        <div className="flex flex-row items-center w-full gap-10 px-10">
          <p className="text-center w-28">{"Tau"}</p>
          <input
            type="range"
            step="0.01"
            min="0.01"
            max="2"
            value={tau}
            onChange={(e) => setTau(parseFloat(e.target.value))}
            className="w-1/2 p-1 transition-colors duration-300 cursor-pointer accent-slate-800 hover:accent-slate-700"
          />
          <p className="w-10 font-bold text-center">{tau}</p>
        </div>

        <div className="flex flex-row items-center w-full gap-10 px-10">
          <p className="text-center w-28">{"Kp"}</p>
          <input
            type="range"
            step="0.01"
            min="0"
            max="2"
            value={kp}
            onChange={(e) => setKp(parseFloat(e.target.value))}
            className="w-1/2 p-1 transition-colors duration-300 cursor-pointer accent-slate-800 hover:accent-slate-700"
          />
          <p className="w-10 font-bold text-center">{kp}</p>
        </div>

        <div className="flex flex-row items-center w-full gap-10 px-10">
          <p className="text-center w-28">{"Kd"}</p>
          <input
            type="range"
            step="0.01"
            min="0"
            max="2"
            value={kd}
            onChange={(e) => setKd(parseFloat(e.target.value))}
            className="w-1/2 p-1 transition-colors duration-300 cursor-pointer accent-slate-800 hover:accent-slate-700"
          />
          <p className="w-10 font-bold text-center">{kd}</p>
        </div>

        <div className="flex flex-row items-center w-full gap-10 px-10">
          <p className="text-center w-28 leading-[1.25rem]">{m.delay()}</p>
          <input
            type="range"
            step="0"
            min="1"
            max="121"
            value={velocityFrameDelay}
            onChange={(e) => setVelocityFrameDelay(parseInt(e.target.value))}
            className="w-1/2 p-1 transition-colors duration-300 cursor-pointer accent-slate-800 hover:accent-slate-700"
          />
          <p className="w-10 font-bold text-center">
            {(velocityFrameDelay / FRAME_RATE).toFixed(1)}s
          </p>
        </div>
      </section>

      <section className="flex flex-col items-center justify-center w-full h-full gap-2 py-5">
        <h2 className="text-lg">{m.leadingCarVelocity()}</h2>
        <Line
          data={{
            labels: leadingCarChart
              .map((entry) => (entry.time * 10) / 2)
              .concat(
                ((leadingCarChart[leadingCarChart.length - 1].time + 1) * 10) /
                  2
              ),
            datasets: [
              {
                data: leadingCarChart
                  .map((entry) => entry.velocity)
                  .concat(leadingCarChart[0].velocity),
                fill: false,
                borderColor: "rgb(118, 136, 163)",
                tension: 0.4,
                pointRadius: (ctx) => (ctx.dataIndex === 5 ? 0 : 5),
                pointHoverRadius: 10,
                pointHitRadius: (ctx) => (ctx.dataIndex === 5 ? 0 : 20),
              },
            ],
          }}
          options={{
            onHover: (event, chartElements) => {
              (event?.native?.target as HTMLElement).style.cursor =
                chartElements?.length > 0 ? "pointer" : "auto";
            },
            maintainAspectRatio: false,
            plugins: {
              tooltip: {
                callbacks: {
                  label: (context) => {
                    if (context.dataIndex === 5) {
                      return "Initial velocity";
                    }
                    return `${context.dataset.data[context.dataIndex]} m/s`;
                  },
                },
              },
              legend: {
                display: false,
              },
              dragData: {
                round: 0,
                onDragEnd: function (_, __, index, value) {
                  if (index !== 5) {
                    setLeadingCarChart((prev) => {
                      const newChart = [...prev];
                      newChart[index].velocity = value;
                      return newChart;
                    });
                  }
                },
              },
            },
            scales: {
              x: {
                title: {
                  display: true,
                  text: m.time() + " (s)",
                },
              },
              y: {
                title: {
                  display: true,
                  text: m.velocity() + " (m/s)",
                },
                beginAtZero: true,
                max: MAX_VELOCITY,
              },
            },
          }}
        />
      </section>
    </>
  );
};
export default SettingsSliver;
