
"use client";

import type { FC } from 'react';
import { MousePointer, PenLine, Eraser, Minus, Image as ImageIcon, Eye, EyeOff, Trash2, Layers, FileX2, Undo, Redo, Paintbrush } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { Tool, TracingImage } from '@/types';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const tools: { name: Tool; icon: FC<React.ComponentProps<'svg'>>; label: string }[] = [
  { name: 'select', icon: MousePointer, label: 'Select Tool (V)' },
  { name: 'line', icon: PenLine, label: 'Line Tool (L)' },
  { name: 'marker', icon: Paintbrush, label: 'Marker Tool (B)' },
  { name: 'erase', icon: Eraser, label: 'Erase Tool (E)' },
];

const colors = [
    { value: 'hsl(var(--foreground))', label: 'Black' },
    { value: 'hsl(var(--destructive))', label: 'Red' },
    { value: 'hsl(var(--primary))', label: 'Blue' }
];

const widths = [
    { value: 1, label: 'Thin' },
    { value: 3, label: 'Medium' },
    { value: 6, label: 'Thick' }
];

interface ToolbarProps {
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;
  activeColor: string;
  setActiveColor: (color: string) => void;
  activeWidth: number;
  setActiveWidth: (width: number) => void;
  tracingImage: TracingImage | null;
  setTracingImage: (image: TracingImage | null) => void;
  onImageUpload: () => void;
  onClear: (what: 'strokes' | 'image' | 'all') => void;
  canDelete: boolean;
  onSelectSame: (criteria: 'color' | 'strokeWidth' | 'both') => void;
  onUndo: () => void;
  canUndo: boolean;
  onRedo: () => void;
  canRedo: boolean;
  snapToAngle: boolean;
  onToggleSnapToAngle: () => void;
  orthoMode: boolean;
  onToggleOrthoMode: () => void;
}

export function Toolbar({
  activeTool,
  setActiveTool,
  activeColor,
  setActiveColor,
  activeWidth,
  setActiveWidth,
  tracingImage,
  setTracingImage,
  onImageUpload,
  onClear,
  canDelete,
  onSelectSame,
  onUndo,
  canUndo,
  onRedo,
  canRedo,
  snapToAngle,
  onToggleSnapToAngle,
  orthoMode,
  onToggleOrthoMode,
}: ToolbarProps) {

  const handleOpacityChange = (value: number[]) => {
    if (tracingImage) {
      setTracingImage({ ...tracingImage, opacity: value[0] });
    }
  };

  const toggleVisibility = () => {
    if (tracingImage) {
      setTracingImage({ ...tracingImage, visible: !tracingImage.visible });
    }
  };

  const deleteImage = () => {
    setTracingImage(null);
    if(activeTool === 'image') setActiveTool('select');
  };
  
  const handleImageToolClick = () => {
      if (tracingImage) {
          setActiveTool('image');
      } else {
          onImageUpload();
      }
  }

  return (
    <Card className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 shadow-lg">
      <CardContent className="p-2">
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={onUndo}
                aria-label="Undo"
                disabled={!canUndo}
              >
                <Undo className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Undo (Ctrl+Z)</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={onRedo}
                aria-label="Redo"
                disabled={!canRedo}
              >
                <Redo className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Redo (Ctrl+Y)</p>
            </TooltipContent>
          </Tooltip>
          
          <Separator orientation="vertical" className="mx-2 h-8" />
          
          {tools.map(({ name, icon: Icon, label }) => (
            <Tooltip key={name}>
              <TooltipTrigger asChild>
                <Button
                  variant='outline'
                  size="icon"
                  onClick={() => setActiveTool(name)}
                  aria-label={label}
                  className={cn(
                    'bg-background hover:bg-accent hover:text-accent-foreground',
                    activeTool === name && 'bg-accent text-accent-foreground'
                  )}
                >
                  <Icon className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{label}</p>
              </TooltipContent>
            </Tooltip>
          ))}
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                      variant='outline'
                      size="icon"
                      onClick={handleImageToolClick}
                      aria-label="Image Tool"
                      className={cn(
                        'bg-background hover:bg-accent hover:text-accent-foreground',
                        activeTool === 'image' && 'bg-accent text-accent-foreground'
                      )}
                    >
                      <ImageIcon className="h-5 w-5" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{tracingImage ? 'Image Tool (I)' : 'Upload Tracing Image'}</p>
                </TooltipContent>
            </Tooltip>
          
          <Separator orientation="vertical" className="mx-2 h-8" />
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant='outline'
                size="icon"
                onClick={onToggleSnapToAngle}
                aria-label="Toggle Angle Snap"
                className={cn(
                  'bg-background hover:bg-accent hover:text-accent-foreground w-10 h-10 font-bold text-xs',
                  snapToAngle && 'bg-accent text-accent-foreground'
                )}
              >
                15°
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Snap to 15° Angles</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant='outline'
                size="icon"
                onClick={onToggleOrthoMode}
                aria-label="Toggle Ortho Mode"
                className={cn(
                  'bg-background hover:bg-accent hover:text-accent-foreground w-10 h-10 font-bold text-xs',
                  orthoMode && 'bg-accent text-accent-foreground'
                )}
              >
                OT
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Ortho Mode</p>
            </TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <Tooltip>
                <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant='outline'
                            size="icon"
                            aria-label="Select Same"
                            disabled={!canDelete}
                            className="w-10 h-10 font-bold"
                        >
                            SS
                        </Button>
                    </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Select Same</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="center" side="top">
              <DropdownMenuItem onClick={() => onSelectSame('color')}>Same Color</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSelectSame('strokeWidth')}>Same Thickness</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSelectSame('both')}>Same Color & Thickness</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <Tooltip>
                <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant='outline'
                            size="icon"
                            aria-label="Clear Canvas"
                        >
                            <FileX2 className="h-5 w-5"/>
                        </Button>
                    </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Clear Canvas</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="center" side="top">
              <DropdownMenuItem onClick={() => onClear('strokes')}>Clear Strokes</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onClear('image')} disabled={!tracingImage}>Clear Image</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onClear('all')}>Clear All</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {tracingImage && (
            <>
            <Separator orientation="vertical" className="mx-2 h-8" />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Image Layer Options">
                  <Layers className="h-5 w-5"/>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56" align="center" side="top">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium leading-none">Image Layer</h4>
                    <p className="text-sm text-muted-foreground">
                      Adjust tracing image properties.
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                       <Label>Opacity</Label>
                       <span className="text-sm text-muted-foreground">{(tracingImage.opacity * 100).toFixed(0)}%</span>
                    </div>
                    <Slider
                        defaultValue={[tracingImage.opacity]}
                        max={1}
                        step={0.05}
                        onValueChange={handleOpacityChange}
                    />
                     <div className="flex items-center justify-between pt-2">
                        <Button variant="outline" size="sm" onClick={toggleVisibility} className="gap-2">
                            {tracingImage.visible ? <EyeOff/> : <Eye/>}
                            {tracingImage.visible ? 'Hide' : 'Show'}
                        </Button>
                        <Button variant="destructive" size="sm" onClick={deleteImage} className="gap-2">
                           <Trash2/> Delete
                        </Button>
                     </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            </>
          )}


          <Separator orientation="vertical" className="mx-2 h-8" />

          {colors.map((color) => (
             <Tooltip key={color.value}>
              <TooltipTrigger asChild>
                <button
                  className={cn(
                    'h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                    activeColor === color.value
                      ? 'border-accent'
                      : 'border-transparent'
                  )}
                  style={{ backgroundColor: color.value }}
                  onClick={() => setActiveColor(color.value)}
                  aria-label={`Select color ${color.label}`}
                />
              </TooltipTrigger>
              <TooltipContent>
                <p>{color.label}</p>
              </TooltipContent>
            </Tooltip>
          ))}
            
          <Separator orientation="vertical" className="mx-2 h-8" />

          {widths.map((width) => (
             <Tooltip key={width.value}>
              <TooltipTrigger asChild>
                 <Button
                  variant='outline'
                  size="icon"
                  onClick={() => setActiveWidth(width.value)}
                  aria-label={width.label}
                  className={cn(
                    'bg-background hover:bg-accent hover:text-accent-foreground',
                    activeWidth === width.value && 'bg-accent text-accent-foreground'
                  )}
                >
                  <Minus className="h-5 w-5" style={{ transform: `scaleY(${width.value / 4})`}}/>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{width.label}</p>
              </TooltipContent>
            </Tooltip>
          ))}

        </div>
      </CardContent>
    </Card>
  );
}
