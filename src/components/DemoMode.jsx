"use client";
import { useState, useCallback, useRef } from 'react';
import { Play, Square } from 'lucide-react';
import { DEMO_SCENARIO } from '../utils/demoScenario';
import './DemoMode.css';

export default function DemoMode({ onInjectUtterance, disabled = false }) {
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const timeoutsRef = useRef([]);

  const stopDemo = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    setIsRunning(false);
    setCurrentStep(0);
  }, []);

  const runDemo = useCallback(() => {
    if (isRunning) return;
    setIsRunning(true);
    setCurrentStep(0);

    const exchanges = DEMO_SCENARIO.exchanges;
    let cumulativeDelay = 500; // initial pause

    exchanges.forEach((exchange, index) => {
      cumulativeDelay += exchange.delay;

      const timeout = setTimeout(() => {
        setCurrentStep(index + 1);
        onInjectUtterance(exchange.role, exchange.originalText);
      }, cumulativeDelay);

      timeoutsRef.current.push(timeout);
    });

    // Auto-stop after last exchange + buffer
    const endTimeout = setTimeout(() => {
      setIsRunning(false);
    }, cumulativeDelay + 5000);
    timeoutsRef.current.push(endTimeout);
  }, [isRunning, onInjectUtterance]);

  const total = DEMO_SCENARIO.exchanges.length;

  return (
    <div className="demo-mode">
      {!isRunning ? (
        <button className="demo-mode__btn demo-mode__btn--start" onClick={runDemo} disabled={disabled}>
          <Play size={14} />
          <span>Run Demo</span>
        </button>
      ) : (
        <>
          <span className="demo-mode__progress">{currentStep}/{total}</span>
          <button className="demo-mode__btn demo-mode__btn--stop" onClick={stopDemo}>
            <Square size={14} />
          </button>
        </>
      )}
    </div>
  );
}
