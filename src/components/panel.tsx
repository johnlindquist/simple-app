import React, { RefObject, useEffect, useRef } from 'react';
import parse from 'html-react-parser';

interface PanelProps {
  panelHTML: string;
  onPanelHeightChanged: (height: number) => void;
  width: number;
  height: number;
}

export default React.forwardRef<HTMLDivElement, PanelProps>(function Panel(
  { panelHTML, onPanelHeightChanged, width, height }: PanelProps,
  ref
) {
  const containerRef: RefObject<any> = useRef(null);

  useEffect(() => {
    if (containerRef?.current?.firstElementChild) {
      onPanelHeightChanged(
        containerRef?.current?.firstElementChild?.clientHeight
      );
    }
  }, [onPanelHeightChanged, containerRef?.current?.firstElementChild]);

  return (
    <div
      ref={containerRef}
      style={
        {
          WebkitAppRegion: 'no-drag',
          WebkitUserSelect: 'text',
          width,
          height,
        } as any
      }
    >
      {parse(`<div>${panelHTML}</div>`)}
    </div>
  );
});