
"use client";

import * as React from 'react';
import type { Line, Point, SelectionBox, Tool, TracingImage } from '@/types';
import { Toolbar } from '@/components/vectorease/toolbar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Paintbrush, Trash2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Helper function to check if a point is near a line segment
function isPointNearLine(point: Point, line: Line, threshold: number = 15): boolean { // Increased threshold for touch
  const { p1, p2 } = line;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    const distSq = (point.x - p1.x) ** 2 + (point.y - p1.y) ** 2;
    return Math.sqrt(distSq) < threshold;
  }
  let t = ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const closestX = p1.x + t * dx;
  const closestY = p1.y + t * dy;
  const distSq = (point.x - closestX) ** 2 + (point.y - closestY) ** 2;
  return Math.sqrt(distSq) < threshold;
}

// Helper to check if a line is entirely within a rectangle
function isLineInsideRect(line: Line, rect: SelectionBox): boolean {
  const normRect = normalizeRect(rect);
  const p1_in = line.p1.x >= normRect.x && line.p1.x <= normRect.x + normRect.width && line.p1.y >= normRect.y && line.p1.y <= normRect.y + normRect.height;
  const p2_in = line.p2.x >= normRect.x && line.p2.x <= normRect.x + normRect.width && line.p2.y >= normRect.y && line.p2.y <= normRect.y + normRect.height;
  return p1_in && p2_in;
}

// Helper to check if a line intersects with a rectangle
function doesLineIntersectRect(line: Line, rect: SelectionBox): boolean {
    const normRect = normalizeRect(rect);
    const { p1, p2 } = line;
    const { x, y, width, height } = normRect;
    const minX = x;
    const maxX = x + width;
    const minY = y;
    const maxY = y + height;

    // Check if any endpoint is inside the rect
    if ((p1.x >= minX && p1.x <= maxX && p1.y >= minY && p1.y <= maxY) ||
        (p2.x >= minX && p2.x <= maxX && p2.y >= minY && p2.y <= maxY)) {
        return true;
    }

    // Check for intersection with each of the 4 sides of the rectangle
    const rectLines = [
        { p1: { x: minX, y: minY }, p2: { x: maxX, y: minY } },
        { p1: { x: maxX, y: minY }, p2: { x: maxX, y: maxY } },
        { p1: { x: maxX, y: maxY }, p2: { x: minX, y: maxY } },
        { p1: { x: minX, y: maxY }, p2: { x: minX, y: minY } },
    ];
    
    for (const rectLine of rectLines) {
        if (doLinesIntersect(line, rectLine as Line)) return true;
    }

    return false;
}

// Check if two line segments intersect
function doLinesIntersect(l1: Line, l2: Line): boolean {
    const { p1: { x: x1, y: y1 }, p2: { x: x2, y: y2 } } = l1;
    const { p1: { x: x3, y: y3 }, p2: { x: x4, y: y4 } } = l2;

    const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (den === 0) return false;

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den;
    
    return t > 0 && t < 1 && u > 0 && u < 1;
}


function normalizeRect(rect: SelectionBox): SelectionBox {
    return {
        x: rect.width < 0 ? rect.x + rect.width : rect.x,
        y: rect.height < 0 ? rect.y + rect.height : rect.y,
        width: Math.abs(rect.width),
        height: Math.abs(rect.height),
    };
}

const GRIP_SIZE = 8;

export default function VectorEasePage() {
  const [history, setHistory] = React.useState<Line[][]>([[]]);
  const [historyIndex, setHistoryIndex] = React.useState(0);
  const lines = history[historyIndex] || [];

  const setLines = (updater: React.SetStateAction<Line[]>, fromHistory: boolean = false) => {
    if (fromHistory) {
      const newLines = typeof updater === 'function' ? updater(lines) : updater;
    } else {
      setHistory(prevHistory => {
        const currentLines = prevHistory[historyIndex] || [];
        const newHistory = prevHistory.slice(0, historyIndex + 1);
        const newLines = typeof updater === 'function' ? updater(currentLines) : updater;
        return [...newHistory, newLines];
      });
      setHistoryIndex(prevIndex => prevIndex + 1);
    }
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
    }
  };

  const [activeTool, setActiveTool] = React.useState<Tool>('select');
  const [activeColor, setActiveColor] = React.useState<string>('hsl(var(--foreground))');
  const [activeWidth, setActiveWidth] = React.useState<number>(1);
  const [selectedIndices, setSelectedIndices] = React.useState<number[]>([]);
  const [tracingImage, setTracingImage] = React.useState<TracingImage | null>(null);
  const [snapToAngle, setSnapToAngle] = React.useState<boolean>(false);
  const [orthoMode, setOrthoMode] = React.useState<boolean>(false);

  const [interactionState, setInteractionState] = React.useState<'none' | 'drawing' | 'selecting' | 'dragging' | 'resizing' | 'erasing' | 'image-panning' | 'image-resizing' | 'image-rotating'>('none');
  const [resizeInfo, setResizeInfo] = React.useState<{lineIndex: number, grip: 'p1' | 'p2'} | null>(null);
  const [imageResizeInfo, setImageResizeInfo] = React.useState<{ corner: 'tl' | 'tr' | 'bl' | 'br', originalImage: TracingImage} | null>(null);
  const [imageRotateInfo, setImageRotateInfo] = React.useState<{originalImage: TracingImage} | null>(null);


  const [drawingLine, setDrawingLine] = React.useState<Line | null>(null);
  const [selectionBox, setSelectionBox] = React.useState<SelectionBox | null>(null);
  const [floatingToolbarPosition, setFloatingToolbarPosition] = React.useState<Point | null>(null);

  const svgRef = React.useRef<SVGSVGElement>(null);
  const imageInputRef = React.useRef<HTMLInputElement>(null);
  const interactionStartPoint = React.useRef<Point | null>(null);
  const lastInteractionPoint = React.useRef<Point | null>(null);
  const initialDragPositions = React.useRef<Map<number, Line>>(new Map());
  const dragLockedAxis = React.useRef<'x' | 'y' | null>(null);
  const activePointerId = React.useRef<number | null>(null);

  // Load state from localStorage on mount
  React.useEffect(() => {
    try {
      const savedState = localStorage.getItem('vectorEaseState');
      if (savedState) {
        const { lines: savedLines, activeTool, activeColor, activeWidth, tracingImage } = JSON.parse(savedState);
        const initialLines = savedLines || [];
        setHistory([[...initialLines]]);
        setHistoryIndex(0);
        setActiveTool(activeTool || 'select');
        setActiveColor(activeColor || 'hsl(var(--foreground))');
        setActiveWidth(activeWidth || 1);
        setTracingImage(tracingImage || null);
      }
    } catch (error) {
      console.error("Failed to load state from localStorage", error);
    }
  }, []);

  // Save state to localStorage on change
  React.useEffect(() => {
    try {
      const stateToSave = {
        lines,
        activeTool,
        activeColor,
        activeWidth,
        tracingImage,
      };
      localStorage.setItem('vectorEaseState', JSON.stringify(stateToSave));
    } catch (error)
    {
      console.error("Failed to save state to localStorage", error);
    }
  }, [lines, activeTool, activeColor, activeWidth, tracingImage]);
  
  React.useEffect(() => {
    if (selectedIndices.length > 0) {
      updateFloatingToolbarPosition();
    } else {
      setFloatingToolbarPosition(null);
    }
  }, [selectedIndices, lines]);

  const updateFloatingToolbarPosition = () => {
    if (selectedIndices.length === 0) {
      setFloatingToolbarPosition(null);
      return;
    }
    const svg = svgRef.current;
    if (!svg) return;

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    selectedIndices.forEach(index => {
      const line = lines[index];
      if (line) {
        minX = Math.min(minX, line.p1.x, line.p2.x);
        minY = Math.min(minY, line.p1.y, line.p2.y);
        maxX = Math.max(maxX, line.p1.x, line.p2.x);
        maxY = Math.max(maxY, line.p1.y, line.p2.y);
      }
    });

    const ctm = svg.getScreenCTM();
    if (ctm) {
        const svgPoint = svg.createSVGPoint();
        svgPoint.x = (minX + maxX) / 2;
        svgPoint.y = minY - 10; // Position above the bounding box
        const screenPoint = svgPoint.matrixTransform(ctm);
        setFloatingToolbarPosition({ x: screenPoint.x, y: screenPoint.y });
    }
  };


  const updateSelectedLinesProperty = React.useCallback((property: 'color' | 'strokeWidth', value: string | number) => {
    if (selectedIndices.length === 0) return;
    setLines(currentLines => {
      const newLines = [...currentLines];
      selectedIndices.forEach(index => {
        if (newLines[index]) {
            newLines[index] = { ...newLines[index], [property]: value };
        }
      });
      return newLines;
    });
  }, [selectedIndices, lines]);

  const handleSetActiveColor = (color: string) => {
    setActiveColor(color);
    if(selectedIndices.length > 0){
        updateSelectedLinesProperty('color', color);
    }
  };

  const handleSetActiveWidth = (width: number) => {
    setActiveWidth(width);
    if(selectedIndices.length > 0){
        updateSelectedLinesProperty('strokeWidth', width);
    }
  };

  const getPointInSVG = (e: React.PointerEvent): Point | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    
    const point = svg.createSVGPoint();
    point.x = e.clientX;
    point.y = e.clientY;
    
    const ctm = svg.getScreenCTM()?.inverse();
    const result = ctm ? point.matrixTransform(ctm) : { x: 0, y: 0 };
    
    if (isNaN(result.x) || isNaN(result.y) || !isFinite(result.x) || !isFinite(result.y)) {
        console.warn("Invalid point coordinates detected", result);
        return null;
    }

    lastInteractionPoint.current = result;
    return result;
  };

  const handleInteractionStart = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return; // Only main button
    if (activePointerId.current !== null && activePointerId.current !== e.pointerId) return;

    const svg = svgRef.current;
    if (svg) {
        svg.setPointerCapture(e.pointerId);
        activePointerId.current = e.pointerId;
    }
    
    const currentPoint = getPointInSVG(e);
    if (!currentPoint) return;
    
    interactionStartPoint.current = currentPoint;
    dragLockedAxis.current = null;
    
    if (activeTool === 'line' || activeTool === 'marker') {
      setInteractionState('drawing');
      setDrawingLine({ p1: currentPoint, p2: currentPoint, color: activeColor, strokeWidth: activeWidth, type: activeTool });
    } else if (activeTool === 'select') {
        // Check if a resize grip of a selected line was clicked
        for (const index of selectedIndices) {
            const line = lines[index];
            if (!line) continue;
            const gripPositions = getGripPositions(line);
            const distToP1Grip = Math.hypot(currentPoint.x - gripPositions.p1.x, currentPoint.y - gripPositions.p1.y);
            const distToP2Grip = Math.hypot(currentPoint.x - gripPositions.p2.x, currentPoint.y - gripPositions.p2.y);
            
            const gripThreshold = GRIP_SIZE * 2;
            if (distToP1Grip <= gripThreshold) {
                setInteractionState('resizing');
                setResizeInfo({ lineIndex: index, grip: 'p1' });
                return;
            }
            if (distToP2Grip <= gripThreshold) {
                setInteractionState('resizing');
                setResizeInfo({ lineIndex: index, grip: 'p2' });
                return;
            }
        }
        
        const clickedIndex = lines.findIndex(line => isPointNearLine(currentPoint, line));

        if (clickedIndex !== -1) {
            const isAlreadySelected = selectedIndices.includes(clickedIndex);
            
            // Allow resizing an unselected line by grabbing an endpoint
            if (!isAlreadySelected) {
                const line = lines[clickedIndex];
                const distToP1 = Math.hypot(currentPoint.x - line.p1.x, currentPoint.y - line.p1.y);
                const distToP2 = Math.hypot(currentPoint.x - line.p2.x, currentPoint.y - line.p2.y);
                const endpointThreshold = GRIP_SIZE * 2.5;

                if (distToP1 < endpointThreshold || distToP2 < endpointThreshold) {
                    if (!e.shiftKey) {
                        setSelectedIndices([clickedIndex]);
                    } else {
                        setSelectedIndices(prev => [...prev, clickedIndex]);
                    }
                    setInteractionState('resizing');
                    setResizeInfo({ lineIndex: clickedIndex, grip: distToP1 < distToP2 ? 'p1' : 'p2' });
                    return;
                }
            }
            
            setInteractionState('dragging');

            if (e.shiftKey) {
                if (isAlreadySelected) {
                    setSelectedIndices(selectedIndices.filter(i => i !== clickedIndex));
                    setInteractionState('none');
                    return;
                } else {
                    setSelectedIndices([...selectedIndices, clickedIndex]);
                }
            } else if (!isAlreadySelected) {
                setSelectedIndices([clickedIndex]);
            }
            
            initialDragPositions.current.clear();
            const indicesToDrag = selectedIndices.includes(clickedIndex) ? selectedIndices : [clickedIndex];
            indicesToDrag.forEach(index => {
                initialDragPositions.current.set(index, lines[index]);
            });


        } else {
            setInteractionState('selecting');
            setSelectionBox({ x: currentPoint.x, y: currentPoint.y, width: 0, height: 0 });
            if (!e.shiftKey) {
                setSelectedIndices([]);
            }
        }
    } else if (activeTool === 'erase') {
      setInteractionState('erasing');
      eraseLinesAtPoint(currentPoint);
    } else if (activeTool === 'image' && tracingImage) {
        // Image interactions
        const {x, y, width, height, rotation} = tracingImage;
        const centerX = x + width / 2;
        const centerY = y + height / 2;

        const corners = {
            tl: {x: x, y: y},
            tr: {x: x + width, y: y},
            bl: {x: x, y: y + height},
            br: {x: x + width, y: y + height},
        };

        const rotateHandle = { x: x + width / 2, y: y - 20 };
        const rotatedRotateHandle = rotatePoint(rotateHandle, {x: centerX, y: centerY}, rotation);
        if (dist(currentPoint, rotatedRotateHandle) < GRIP_SIZE * 2.5) {
            setInteractionState('image-rotating');
            setImageRotateInfo({ originalImage: tracingImage });
            return;
        }

        for (const [key, cornerPoint] of Object.entries(corners)) {
            const rotatedCorner = rotatePoint(cornerPoint, {x: centerX, y: centerY}, rotation);
            if (dist(currentPoint, rotatedCorner) < GRIP_SIZE * 2.5) {
                setInteractionState('image-resizing');
                setImageResizeInfo({ corner: key as 'tl' | 'tr' | 'bl' | 'br', originalImage: tracingImage });
                return;
            }
        }

        if (isPointInRotatedRect(currentPoint, tracingImage)) {
            setInteractionState('image-panning');
        }
    }
  };
  
  const getSnappedPoint = (currentPoint: Point, anchorPoint: Point): Point => {
    if (orthoMode) {
        const dx = Math.abs(currentPoint.x - anchorPoint.x);
        const dy = Math.abs(currentPoint.y - anchorPoint.y);
        if (dx > dy) {
            return { x: currentPoint.x, y: anchorPoint.y };
        } else {
            return { x: anchorPoint.x, y: currentPoint.y };
        }
    }
    
    if (snapToAngle) {
        const angle = Math.atan2(currentPoint.y - anchorPoint.y, currentPoint.x - anchorPoint.x);
        const snapAngle = Math.PI / 12; // 15 degrees
        const snappedAngle = Math.round(angle / snapAngle) * snapAngle;
        const dist = Math.hypot(currentPoint.y - anchorPoint.y, currentPoint.x - anchorPoint.x);
        
        return {
          x: anchorPoint.x + dist * Math.cos(snappedAngle),
          y: anchorPoint.y + dist * Math.sin(snappedAngle),
        };
    }

    return currentPoint;
  };

  const handleInteractionMove = (e: React.PointerEvent) => {
    if (activePointerId.current !== e.pointerId) return;

    const currentPoint = getPointInSVG(e);
    if (!currentPoint) return;
    
    if (interactionState === 'none' || !interactionStartPoint.current) return;
    const start = interactionStartPoint.current!;
    let dx = currentPoint.x - start.x;
    let dy = currentPoint.y - start.y;
    
    switch (interactionState) {
        case 'drawing':
            if (drawingLine) {
                const snappedPoint = getSnappedPoint(currentPoint, drawingLine.p1);
                setDrawingLine({ ...drawingLine, p2: snappedPoint });
            }
            break;
        case 'selecting':
            if (selectionBox) {
                setSelectionBox({
                    x: start.x,
                    y: start.y,
                    width: currentPoint.x - start.x,
                    height: currentPoint.y - start.y,
                });
            }
            break;
        case 'dragging': {
            if (orthoMode) {
                if (!dragLockedAxis.current) {
                    if (Math.abs(dx) > Math.abs(dy)) {
                        dragLockedAxis.current = 'x';
                    } else {
                        dragLockedAxis.current = 'y';
                    }
                }
                if (dragLockedAxis.current === 'x') {
                    dy = 0;
                } else {
                    dx = 0;
                }
            }

            const newLines = [...lines];
            initialDragPositions.current.forEach((originalLine, index) => {
                newLines[index] = {
                    ...originalLine,
                    p1: { x: originalLine.p1.x + dx, y: originalLine.p1.y + dy },
                    p2: { x: originalLine.p2.x + dx, y: originalLine.p2.y + dy },
                };
            });
            setHistory(prev => {
                const tempHistory = [...prev];
                tempHistory[historyIndex] = newLines;
                return tempHistory;
            });
            break;
        }
        case 'resizing': {
            if (resizeInfo) {
                const originalLine = lines[resizeInfo.lineIndex];
                const anchorPoint = resizeInfo.grip === 'p1' ? originalLine.p2 : originalLine.p1;
                const snappedPoint = getSnappedPoint(currentPoint, anchorPoint);

                const newLines = lines.map((line, index) => {
                    if (index === resizeInfo.lineIndex) {
                        return {
                            ...line,
                            [resizeInfo.grip]: snappedPoint,
                        }
                    }
                    return line;
                });
                setHistory(prev => {
                    const tempHistory = [...prev];
                    tempHistory[historyIndex] = newLines;
                    return tempHistory;
                });
            }
            break;
        }
        case 'erasing': 
            eraseLinesAtPoint(currentPoint);
            break;
        case 'image-panning':
            if(tracingImage) {
                setTracingImage({...tracingImage, x: tracingImage.x + dx, y: tracingImage.y + dy});
                interactionStartPoint.current = currentPoint;
            }
            break;
        case 'image-rotating':
            if (tracingImage && imageRotateInfo) {
                const { x, y, width, height } = imageRotateInfo.originalImage;
                const centerX = x + width / 2;
                const centerY = y + height / 2;
                const angle = Math.atan2(currentPoint.y - centerY, currentPoint.x - centerX) * 180 / Math.PI + 90;
                setTracingImage({ ...tracingImage, rotation: angle });
            }
            break;
        case 'image-resizing':
            if (tracingImage && imageResizeInfo) {
                const { originalImage, corner } = imageResizeInfo;
                const { x, y, width, height, rotation } = originalImage;
                const centerX = x + width / 2;
                const centerY = y + height / 2;
            
                const rotatedStartPoint = rotatePoint(start, { x: centerX, y: centerY }, -rotation);
                const rotatedCurrentPoint = rotatePoint(currentPoint, { x: centerX, y: centerY }, -rotation);
            
                const rotatedDx = rotatedCurrentPoint.x - rotatedStartPoint.x;
                const rotatedDy = rotatedCurrentPoint.y - rotatedStartPoint.y;
            
                let newX = x, newY = y, newWidth = width, newHeight = height;
            
                if (corner.includes('l')) {
                    newX = x + rotatedDx;
                    newWidth = width - rotatedDx;
                }
                if (corner.includes('r')) {
                    newWidth = width + rotatedDx;
                }
                if (corner.includes('t')) {
                    newY = y + rotatedDy;
                    newHeight = height - rotatedDy;
                }
                if (corner.includes('b')) {
                    newHeight = height + rotatedDy;
                }

                if (newWidth < 20) {
                    newWidth = 20;
                    if(corner.includes('l')) newX = originalImage.x + originalImage.width - 20;
                }
                if (newHeight < 20) {
                    newHeight = 20;
                     if(corner.includes('t')) newY = originalImage.y + originalImage.height - 20;
                }

                setTracingImage({ ...tracingImage, x: newX, y: newY, width: newWidth, height: newHeight });
            }
            break;

    }
    
    if (interactionState === 'dragging' || interactionState === 'resizing') {
      updateFloatingToolbarPosition();
    }
  };

  const handleInteractionEnd = (e: React.PointerEvent) => {
    if (activePointerId.current !== e.pointerId) return;

    const svg = svgRef.current;
    if (svg) {
        svg.releasePointerCapture(e.pointerId);
        activePointerId.current = null;
    }

    const startPoint = interactionStartPoint.current;
    const finalPoint = getPointInSVG(e) || lastInteractionPoint.current;

    if (!finalPoint) {
      resetInteractions();
      return;
    }


    switch (interactionState) {
        case 'drawing':
            if (drawingLine && startPoint && (startPoint.x !== finalPoint.x || startPoint.y !== finalPoint.y)) {
                setLines(current => [...current, drawingLine]);
            }
            break;
        case 'selecting':
            if (selectionBox && startPoint) {
                const isClick = Math.abs(finalPoint.x - startPoint.x) < 5 && Math.abs(finalPoint.y - startPoint.y) < 5;
                if (isClick && !e.shiftKey) {
                    setSelectedIndices([]);
                } else if (!isClick) {
                    const normBox = normalizeRect(selectionBox);
                    const isCrossingSelection = selectionBox.width < 0; 
                    const checkFunc = isCrossingSelection ? doesLineIntersectRect : isLineInsideRect;
                    
                    const newSelected = lines.map((line, index) => (
                        checkFunc(line, normBox) ? index : -1
                    )).filter(index => index !== -1);
                    
                    setSelectedIndices(prev => {
                        const combined = new Set(e.shiftKey ? [...prev, ...newSelected] : newSelected);
                        return Array.from(combined);
                    });
                }
            }
            break;
        case 'dragging':
        case 'resizing':
            setLines(lines);
            break;
        case 'image-resizing':
            if (imageResizeInfo) {
               setImageResizeInfo(null);
            }
            break;
    }

    resetInteractions();
  };

  const resetInteractions = () => {
    if (activePointerId.current !== null && svgRef.current) {
        try {
            svgRef.current.releasePointerCapture(activePointerId.current);
        } catch (e) {
            // Ignore if pointer capture is already released
        }
    }
    setInteractionState('none');
    setDrawingLine(null);
    setSelectionBox(null);
    setResizeInfo(null);
    setImageResizeInfo(null);
    setImageRotateInfo(null);
    interactionStartPoint.current = null;
    initialDragPositions.current.clear();
    dragLockedAxis.current = null;
    activePointerId.current = null;
  };
  
  const handleClear = (what: 'strokes' | 'image' | 'all') => {
    if (what === 'strokes' || what === 'all') {
      setLines(() => []);
      setSelectedIndices([]);
    }
    if (what === 'image' || what === 'all') {
      setTracingImage(null);
      if (activeTool === 'image') setActiveTool('select');
    }
  };
  
  const handleDeleteSelected = () => {
    if (selectedIndices.length === 0) return;
    setLines(lines.filter((_, index) => !selectedIndices.includes(index)));
    setSelectedIndices([]);
  };

  const handleDuplicateSelected = () => {
    if (selectedIndices.length === 0) return;
    const newLines: Line[] = [];
    const newSelectedIndices: number[] = [];
    const offset = 10;
    
    selectedIndices.forEach(index => {
      const line = lines[index];
      if (line) {
        const duplicatedLine: Line = {
          ...line,
          p1: { x: line.p1.x + offset, y: line.p1.y + offset },
          p2: { x: line.p2.x + offset, y: line.p2.y + offset },
        };
        newLines.push(duplicatedLine);
      }
    });

    const currentLineCount = lines.length;
    for(let i=0; i < newLines.length; i++) {
        newSelectedIndices.push(currentLineCount + i);
    }
    
    setLines(current => [...current, ...newLines]);
    setSelectedIndices(newSelectedIndices);
  };

  const handleSelectSame = (criteria: 'color' | 'strokeWidth' | 'both') => {
    if (selectedIndices.length === 0) return;

    const referenceLine = lines[selectedIndices[0]];
    if (!referenceLine) return;

    const { color, strokeWidth } = referenceLine;
    
    const newSelectedIndices = lines
      .map((line, index) => {
        const colorMatch = line.color === color;
        const widthMatch = line.strokeWidth === strokeWidth;

        if (criteria === 'color' && colorMatch) return index;
        if (criteria === 'strokeWidth' && widthMatch) return index;
        if (criteria === 'both' && colorMatch && widthMatch) return index;
        
        return -1;
      })
      .filter(index => index !== -1);
      
    setSelectedIndices(newSelectedIndices);
  };

  const eraseLinesAtPoint = (point: Point) => {
    let erased = false;
    const newLines = lines.filter((line) => {
        const near = isPointNearLine(point, line);
        if(near) erased = true;
        return !near;
    });
    
    if(erased) {
        setLines(newLines);
        setSelectedIndices([]);
    }
  };

  const getCursor = () => {
    switch (activeTool) {
      case 'line':
      case 'marker':
        return 'crosshair';
      case 'erase':
        return 'cell';
      case 'select':
        return 'default';
      default:
        return 'default';
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const svg = svgRef.current;
            if(!svg) return;
            const svgWidth = svg.clientWidth;
            const svgHeight = svg.clientHeight;
            
            const aspectRatio = img.width / img.height;
            let width = svgWidth * 0.8;
            let height = width / aspectRatio;

            if (height > svgHeight * 0.8) {
                height = svgHeight * 0.8;
                width = height * aspectRatio;
            }

            setTracingImage({
                src: e.target?.result as string,
                x: (svgWidth - width) / 2,
                y: (svgHeight - height) / 2,
                width: width,
                height: height,
                rotation: 0,
                opacity: 0.5,
                visible: true,
            });
            setActiveTool('image');
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
    event.target.value = ''; // Reset input
  };
  
  function rotatePoint(point: Point, center: Point, angle: number): Point {
    const rad = angle * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    return {
        x: center.x + dx * cos - dy * sin,
        y: center.y + dx * sin + dy * cos,
    };
  }

  function dist(p1: Point, p2: Point) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
  }

  function isPointInRotatedRect(point: Point, rect: TracingImage): boolean {
    const { x, y, width, height, rotation } = rect;
    const center = { x: x + width / 2, y: y + height / 2 };
    const rotatedPoint = rotatePoint(point, center, -rotation);
    return rotatedPoint.x >= x && rotatedPoint.x <= x + width &&
           rotatedPoint.y >= y && rotatedPoint.y <= y + height;
  }
  
  const getGripPositions = (line: Line) => {
      const { p1, p2 } = line;
      return { p1, p2 };
  }

  const RenderedLine = ({ line, isSelected }: { line: Line; isSelected: boolean }) => {
    const { p1, p2, color, strokeWidth, type } = line;
    const strokeColor = isSelected ? 'hsl(var(--accent))' : color;
    
    if (type === 'marker') {
       return (
        <path
            d={`M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeOpacity={0.6}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
      );
    }

    // Default 'line' type
    return (
      <line
        x1={p1.x}
        y1={p1.y}
        x2={p2.x}
        y2={p2.y}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    );
  };
  
  const TracingImageLayer = () => {
    if (!tracingImage || !tracingImage.visible) return null;
    const { src, x, y, width, height, rotation, opacity } = tracingImage;
    const centerX = x + width / 2;
    const centerY = y + height / 2;

    const corners = {
        tl: rotatePoint({ x, y }, { x: centerX, y: centerY }, rotation),
        tr: rotatePoint({ x: x + width, y }, { x: centerX, y: centerY }, rotation),
        bl: rotatePoint({ x, y: y + height }, { x: centerX, y: centerY }, rotation),
        br: rotatePoint({ x: x + width, y: y + height }, { x: centerX, y: centerY }, rotation),
    };
    
    const rotateHandle = rotatePoint({x: centerX, y: y - 20}, {x: centerX, y: centerY}, rotation);

    const showHandles = activeTool === 'image';

    return (
      <g>
        <image
          href={src}
          x={x}
          y={y}
          width={width}
          height={height}
          opacity={opacity}
          transform={`rotate(${rotation} ${centerX} ${centerY})`}
          style={{pointerEvents: 'none'}}
        />
        {showHandles && (
            <g>
                <path d={`M ${corners.tl.x} ${corners.tl.y} L ${corners.tr.x} ${corners.tr.y} L ${corners.br.x} ${corners.br.y} L ${corners.bl.x} ${corners.bl.y} Z`}
                    fill="none" stroke="hsl(var(--accent))" strokeWidth="1" strokeDasharray="3 3"/>
                {Object.values(corners).map((corner, i) => (
                    <circle key={i} cx={corner.x} cy={corner.y} r={GRIP_SIZE} fill="hsl(var(--accent))" style={{ cursor: 'pointer' }} />
                ))}
                <line x1={centerX} y1={centerY} x2={rotateHandle.x} y2={rotateHandle.y} stroke="hsl(var(--accent))" strokeWidth="1" />
                <circle cx={rotateHandle.x} cy={rotateHandle.y} r={GRIP_SIZE} fill="hsl(var(--accent))" style={{ cursor: 'alias' }}/>
            </g>
        )}
      </g>
    );
  };

  const FloatingToolbar = () => {
    if (!floatingToolbarPosition) return null;

    return (
        <div 
            className="absolute z-20 flex items-center gap-2 p-1 rounded-lg bg-card shadow-lg border"
            style={{
                left: `${floatingToolbarPosition.x}px`,
                top: `${floatingToolbarPosition.y}px`,
                transform: 'translate(-50%, -100%)',
            }}
            onPointerDown={(e) => e.stopPropagation()} // Prevent SVG from capturing events on the toolbar
        >
            <Button variant="ghost" size="icon" onClick={handleDuplicateSelected}>
                <Copy className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleDeleteSelected}>
                <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
        </div>
    );
  };

  return (
    <TooltipProvider>
      <div className="relative flex h-screen w-screen flex-col items-center justify-center overflow-hidden bg-background p-4">
        <h1 className="absolute top-4 left-1/2 -translate-x-1/2 text-2xl font-bold text-foreground/80 font-headline">VectorEase</h1>
        
        <FloatingToolbar />
        
        <div className="relative h-full w-full max-w-7xl rounded-lg shadow-lg">
          <svg
            ref={svgRef}
            className="h-full w-full rounded-lg bg-white touch-none"
            style={{ cursor: getCursor() }}
            onPointerDown={handleInteractionStart}
            onPointerMove={handleInteractionMove}
            onPointerUp={handleInteractionEnd}
            onPointerCancel={handleInteractionEnd}
            onPointerLeave={handleInteractionEnd}
          >
            <TracingImageLayer />

            {lines.map((line, i) => (
              <RenderedLine key={`line-${i}`} line={line} isSelected={selectedIndices.includes(i)} />
            ))}

            {activeTool === 'select' && selectedIndices.map(index => {
                const line = lines[index];
                if (!line) return null;
                const gripPositions = getGripPositions(line);
                return (
                    <React.Fragment key={`grips-container-${index}`}>
                        <circle key={`grip-${index}-p1`} cx={gripPositions.p1.x} cy={gripPositions.p1.y} r={GRIP_SIZE} fill="none" stroke="hsl(var(--accent))" strokeWidth="1.5" style={{ cursor: 'grab' }} />
                        <circle key={`grip-${index}-p2`} cx={gripPositions.p2.x} cy={gripPositions.p2.y} r={GRIP_SIZE} fill="none" stroke="hsl(var(--accent))" strokeWidth="1.5" style={{ cursor: 'grab' }} />
                    </React.Fragment>
                )
            })}
            
            {drawingLine && (
              <RenderedLine line={drawingLine} isSelected={false} />
            )}

            {selectionBox && (
              <rect
                  x={selectionBox.width > 0 ? selectionBox.x : selectionBox.x + selectionBox.width}
                  y={selectionBox.height > 0 ? selectionBox.y : selectionBox.y + selectionBox.height}
                  width={Math.abs(selectionBox.width)}
                  height={Math.abs(selectionBox.height)}
                  fill="hsl(var(--accent) / 0.2)"
                  stroke="hsl(var(--accent))"
                  strokeWidth="1"
                  strokeDasharray={selectionBox.width < 0 ? "3 3" : "none"}
              />
            )}
          </svg>
        </div>

        <input type="file" ref={imageInputRef} accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
        <Toolbar 
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          activeColor={activeColor}
          setActiveColor={handleSetActiveColor}
          activeWidth={activeWidth}
          setActiveWidth={handleSetActiveWidth}
          tracingImage={tracingImage}
          setTracingImage={setTracingImage}
          onImageUpload={() => imageInputRef.current?.click()}
          onClear={handleClear}
          canDelete={selectedIndices.length > 0}
          onSelectSame={handleSelectSame}
          onUndo={handleUndo}
          canUndo={historyIndex > 0}
          onRedo={handleRedo}
          canRedo={historyIndex < history.length - 1}
          snapToAngle={snapToAngle}
          onToggleSnapToAngle={() => setSnapToAngle(prev => !prev)}
          orthoMode={orthoMode}
          onToggleOrthoMode={() => setOrthoMode(prev => !prev)}
        />
      </div>
    </TooltipProvider>
  );
}
