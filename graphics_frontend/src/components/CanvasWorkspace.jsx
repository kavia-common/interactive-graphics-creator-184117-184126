import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";

/**
 * PUBLIC_INTERFACE
 * CanvasWorkspace
 * A client-side image composition workspace that allows:
 * - Uploading one or multiple images (input and drag-and-drop)
 * - Displaying the images as layers inside a "canvas" area
 * - Selecting and dragging images to reposition them (bounded within the area)
 * - Resizing, rotating, and cropping images with transform controls
 * - Clearing the canvas
 *
 * Usage:
 * <CanvasWorkspace />
 *
 * Notes:
 * - This is a client-only feature. No backend integration is required.
 * - Object URLs are used for displaying uploaded images. They are revoked when layers are removed/cleared.
 * - Styling follows the Ocean Professional theme.
 * - Crop applies to the rendered bitmap region using an offscreen canvas.
 */
function CanvasWorkspace() {
  // Layer model:
  // {
  //   id, src, x, y, width, height, rotation (deg), crop: {x,y,width,height} | null,
  //   isSelected, natural: {w,h}
  // }
  const [layers, setLayers] = useState([]);
  const [dragState, setDragState] = useState(null); // {id, offsetX, offsetY}
  const [transformState, setTransformState] = useState(null);
  // transformState can be:
  // { type: 'resize', id, handle: 'nw'|'n'|'ne'|'e'|'se'|'s'|'sw'|'w', start:{x,y,width,height,mouseX,mouseY,aspect}, constrained:boolean }
  // { type: 'rotate', id, start:{cx,cy,angle0,mouseAngle0} }
  // { type: 'crop', id, mode: 'adjust'|'confirm', box:{x,y,w,h}, start?:{mouseX,mouseY,box} }
  const [keyModifiers, setKeyModifiers] = useState({ shift: false });
  const containerRef = useRef(null);
  const idCounterRef = useRef(0);

  // Theme variables (Ocean Professional)
  const theme = useMemo(
    () => ({
      primary: "#2563EB",
      secondary: "#F59E0B",
      background: "#f9fafb",
      surface: "#ffffff",
      text: "#111827",
      shadow: "0 8px 20px rgba(17, 24, 39, 0.08)",
      border: "1px solid rgba(17, 24, 39, 0.08)",
      radius: "12px",
      danger: "#EF4444",
    }),
    []
  );

  // Helper to compute a default size for an image to fit within the workspace.
  const computeFit = useCallback((imgWidth, imgHeight, maxWidth, maxHeight) => {
    if (imgWidth <= 0 || imgHeight <= 0) return { width: 100, height: 100 };
    const scale = Math.min(maxWidth / imgWidth, maxHeight / imgHeight, 1);
    return { width: Math.round(imgWidth * scale), height: Math.round(imgHeight * scale) };
  }, []);

  // Add files to layers
  const handleFiles = useCallback(
    async (files) => {
      if (!files || files.length === 0) return;
      const container = containerRef.current;
      const rect = container?.getBoundingClientRect();
      const maxWidth = Math.max((rect?.width ?? 800) - 32, 100);
      const maxHeight = Math.max((rect?.height ?? 500) - 32, 100);

      const newLayers = [];
      for (const file of files) {
        if (!file.type.match(/^image\/(png|jpeg|jpg)$/)) continue;
        const src = URL.createObjectURL(file);

        // Load image to get intrinsic size
        const dims = await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ w: img.width, h: img.height });
          img.onerror = () => resolve({ w: 100, h: 100 });
          img.src = src;
        });

        const { width, height } = computeFit(dims.w, dims.h, maxWidth, maxHeight);

        // Place near center with slight stagger to visualize multiple uploads
        const baseX = Math.round(((rect?.width ?? 800) - width) / 2);
        const baseY = Math.round(((rect?.height ?? 500) - height) / 2);
        const offset = newLayers.length * 16;

        idCounterRef.current += 1;
        newLayers.push({
          id: idCounterRef.current,
          src,
          x: baseX + offset,
          y: baseY + offset,
          width,
          height,
          rotation: 0,
          crop: null,
          natural: { w: dims.w, h: dims.h },
          isSelected: false,
        });
      }

      if (newLayers.length > 0) {
        setLayers((prev) => [...prev, ...newLayers]);
      }
    },
    [computeFit]
  );

  // File input change
  const onFileInputChange = useCallback(
    (e) => {
      const files = e.target.files;
      handleFiles(files);
      // reset value so selecting the same file again works
      e.target.value = "";
    },
    [handleFiles]
  );

  // Drag & Drop handlers
  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      const dt = e.dataTransfer;
      if (dt?.files && dt.files.length > 0) {
        handleFiles(dt.files);
      }
    },
    [handleFiles]
  );

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // Key handlers
  useEffect(() => {
    const down = (e) => {
      if (e.key === "Shift") setKeyModifiers((s) => ({ ...s, shift: true }));
      if (e.key === "Escape") {
        // cancel active transform/crop
        setTransformState(null);
      }
    };
    const up = (e) => {
      if (e.key === "Shift") setKeyModifiers((s) => ({ ...s, shift: false }));
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Select a layer and start drag
  const onLayerPointerDown = useCallback(
    (e, id) => {
      // Prevent default to stop text/image drag ghosting
      e.preventDefault();
      e.stopPropagation();

      const containerRect = containerRef.current?.getBoundingClientRect();
      const pointerX = e.clientX - (containerRect?.left ?? 0);
      const pointerY = e.clientY - (containerRect?.top ?? 0);

      setLayers((prev) =>
        prev.map((l) => ({
          ...l,
          isSelected: l.id === id,
        }))
      );

      setDragState(() => {
        const layer = layers.find((l) => l.id === id) || { x: 0, y: 0 };
        return {
          id,
          offsetX: pointerX - layer.x,
          offsetY: pointerY - layer.y,
        };
      });

      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    [layers]
  );

  // Start resize from a handle
  const startResize = useCallback((e, id, handle) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    const mouseX = e.clientX - (rect?.left ?? 0);
    const mouseY = e.clientY - (rect?.top ?? 0);
    const layer = layers.find((l) => l.id === id);
    if (!layer) return;
    setTransformState({
      type: "resize",
      id,
      handle,
      start: {
        x: layer.x,
        y: layer.y,
        width: layer.width,
        height: layer.height,
        mouseX,
        mouseY,
        aspect: layer.width / layer.height,
      },
      constrained: keyModifiers.shift, // hold Shift to lock aspect ratio
    });
  }, [layers, keyModifiers.shift]);

  // Start rotation from rotation handle
  const startRotate = useCallback((e, id) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    const mouseX = e.clientX - (rect?.left ?? 0);
    const mouseY = e.clientY - (rect?.top ?? 0);
    const layer = layers.find((l) => l.id === id);
    if (!layer) return;
    const cx = layer.x + layer.width / 2;
    const cy = layer.y + layer.height / 2;
    const mouseAngle0 = Math.atan2(mouseY - cy, mouseX - cx);
    setTransformState({
      type: "rotate",
      id,
      start: {
        cx,
        cy,
        angle0: (layer.rotation || 0) * (Math.PI / 180),
        mouseAngle0,
      },
    });
  }, [layers]);

  // Enter crop mode (create/edit crop box)
  const startCropMode = useCallback((id) => {
    const layer = layers.find((l) => l.id === id);
    if (!layer) return;
    const box = layer.crop
      ? { x: layer.crop.x, y: layer.crop.y, w: layer.crop.width, h: layer.crop.height }
      : { x: 0, y: 0, w: layer.width, h: layer.height };
    setTransformState({
      type: "crop",
      id,
      mode: "adjust",
      box,
    });
  }, [layers]);

  // Apply crop: bake the crop rect into a new bitmap via offscreen canvas
  const applyCrop = useCallback(async (layerId, cropBox) => {
    const layer = layers.find((l) => l.id === layerId);
    if (!layer) return;
    // Map crop in display space to source image pixels.
    // Compute scale based on natural size -> displayed size BEFORE existing crop.
    // If layer already had crop, we treat current src as already cropped, so map into current bitmap size.
    const img = await new Promise((resolve) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => resolve(image);
      image.src = layer.src;
    });

    const currentBitmapW = img.width;
    const currentBitmapH = img.height;

    // cropBox is in displayed coordinates relative to the layer's box (width/height)
    // Scale factors from displayed to current bitmap
    const scaleX = currentBitmapW / layer.width;
    const scaleY = currentBitmapH / layer.height;

    const sx = Math.max(0, Math.round(cropBox.x * scaleX));
    const sy = Math.max(0, Math.round(cropBox.y * scaleY));
    const sw = Math.max(1, Math.round(cropBox.w * scaleX));
    const sh = Math.max(1, Math.round(cropBox.h * scaleY));

    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    const newUrl = canvas.toDataURL("image/png");

    // Update layer: replace src, reset crop to null, set new size to the crop box size
    setLayers((prev) =>
      prev.map((l) => {
        if (l.id !== layerId) return l;
        try {
          // revoke old object URL if it was one
          if (l.src.startsWith("blob:")) URL.revokeObjectURL(l.src);
        } catch {
          // ignore
        }
        return {
          ...l,
          src: newUrl,
          width: Math.round(cropBox.w),
          height: Math.round(cropBox.h),
          crop: null,
          // keep position; ensure it stays within container bounds later
        };
      })
    );
  }, [layers]);

  // Transform interactions on container move
  const onContainerPointerMove = useCallback(
    (e) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const pointerX = e.clientX - rect.left;
      const pointerY = e.clientY - rect.top;

      if (transformState?.type === "resize") {
        const { id, handle, start, constrained } = transformState;
        const dx = pointerX - start.mouseX;
        const dy = pointerY - start.mouseY;

        setLayers((prev) =>
          prev.map((l) => {
            if (l.id !== id) return l;
            let nx = start.x;
            let ny = start.y;
            let nw = start.width;
            let nh = start.height;

            const applyAspect = (w, h) => {
              if (!constrained) return [w, h];
              const aspect = start.aspect || 1;
              if (Math.abs(dx) > Math.abs(dy)) {
                h = w / aspect;
              } else {
                w = h * aspect;
              }
              return [w, h];
            };

            const anchors = {
              n: () => {
                nh = start.height - dy;
                if (constrained) {
                  [nw, nh] = applyAspect(nw, nh);
                }
                ny = start.y + (start.height - nh);
              },
              s: () => {
                nh = start.height + dy;
                if (constrained) {
                  [nw, nh] = applyAspect(nw, nh);
                }
              },
              w: () => {
                nw = start.width - dx;
                if (constrained) {
                  [nw, nh] = applyAspect(nw, nh);
                }
                nx = start.x + (start.width - nw);
              },
              e: () => {
                nw = start.width + dx;
                if (constrained) {
                  [nw, nh] = applyAspect(nw, nh);
                }
              },
              nw: () => {
                nw = start.width - dx;
                nh = start.height - dy;
                if (constrained) [nw, nh] = applyAspect(nw, nh);
                nx = start.x + (start.width - nw);
                ny = start.y + (start.height - nh);
              },
              ne: () => {
                nw = start.width + dx;
                nh = start.height - dy;
                if (constrained) [nw, nh] = applyAspect(nw, nh);
                ny = start.y + (start.height - nh);
              },
              sw: () => {
                nw = start.width - dx;
                nh = start.height + dy;
                if (constrained) [nw, nh] = applyAspect(nw, nh);
                nx = start.x + (start.width - nw);
              },
              se: () => {
                nw = start.width + dx;
                nh = start.height + dy;
                if (constrained) [nw, nh] = applyAspect(nw, nh);
              },
            };

            anchors[handle]?.();

            // minimum size
            nw = Math.max(10, nw);
            nh = Math.max(10, nh);

            // bound within container
            nx = Math.max(0, Math.min(nx, rect.width - nw));
            ny = Math.max(0, Math.min(ny, rect.height - nh));

            return { ...l, x: Math.round(nx), y: Math.round(ny), width: Math.round(nw), height: Math.round(nh) };
          })
        );
        return;
      }

      if (transformState?.type === "rotate") {
        const { id, start } = transformState;
        setLayers((prev) =>
          prev.map((l) => {
            if (l.id !== id) return l;
            const angleNow = Math.atan2(pointerY - start.cy, pointerX - start.cx);
            const delta = angleNow - start.mouseAngle0;
            const newAngleRad = start.angle0 + delta;
            const newAngleDeg = Math.round((newAngleRad * 180) / Math.PI);
            return { ...l, rotation: newAngleDeg };
          })
        );
        return;
      }

      if (transformState?.type === "crop" && transformState.mode === "adjust") {
        const { id, start, box } = transformState;
        if (!start) return;
        const nx = Math.min(start.mouseX, pointerX);
        const ny = Math.min(start.mouseY, pointerY);
        const nw = Math.abs(pointerX - start.mouseX);
        const nh = Math.abs(pointerY - start.mouseY);
        // Box is in global space; we later convert to layer space for applyCrop
        setTransformState((s) => ({
          ...s,
          box: { x: nx, y: ny, w: nw, h: nh },
        }));
        return;
      }

      // Default: drag move
      if (!dragState || !containerRef.current) return;
      setLayers((prev) =>
        prev.map((l) => {
          if (l.id !== dragState.id) return l;
          const maxX = Math.max(rect.width - l.width, 0);
          const maxY = Math.max(rect.height - l.height, 0);
          let nx = Math.round(pointerX - dragState.offsetX);
          let ny = Math.round(pointerY - dragState.offsetY);
          nx = Math.max(0, Math.min(nx, maxX));
          ny = Math.max(0, Math.min(ny, maxY));
          return { ...l, x: nx, y: ny };
        })
      );
    },
    [dragState, transformState]
  );

  // Start crop drag (to draw crop rectangle) when clicking the crop overlay button
  const beginCropDraw = useCallback((e, id) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    const mouseX = e.clientX - (rect?.left ?? 0);
    const mouseY = e.clientY - (rect?.top ?? 0);
    setTransformState({
      type: "crop",
      id,
      mode: "adjust",
      box: { x: mouseX, y: mouseY, w: 0, h: 0 },
      start: { mouseX, mouseY },
    });
  }, []);

  // Confirm or cancel transforms
  const onContainerPointerUp = useCallback(() => {
    setDragState(null);

    // If crop was started with zero size, keep state; otherwise optional finalize remains to confirm button.
    // For resize/rotate we consider the live changes already applied; just clear transform state.
    if (transformState && transformState.type !== "crop") {
      setTransformState(null);
    }
  }, [transformState]);

  // Clear canvas (revoke object URLs)
  const clearCanvas = useCallback(() => {
    setLayers((prev) => {
      prev.forEach((l) => {
        try {
          if (l.src.startsWith("blob:")) URL.revokeObjectURL(l.src);
        } catch {
          // ignore
        }
      });
      return [];
    });
  }, []);

  // Revoke URLs on unmount
  useEffect(() => {
    return () => {
      layers.forEach((l) => {
        try {
          if (l.src.startsWith("blob:")) URL.revokeObjectURL(l.src);
        } catch {
          // ignore
        }
      });
    };
  }, [layers]);

  // Utility: get selection
  const selectedLayer = useMemo(() => layers.find((l) => l.isSelected), [layers]);

  // When in crop mode, build crop UI box relative to the selected layer
  const getCropBoxRelativeToLayer = useCallback(() => {
    if (!transformState || transformState.type !== "crop" || !selectedLayer) return null;
    const box = transformState.box;
    if (!box) return null;
    // Constrain crop box to selected layer bounds
    const lx = selectedLayer.x;
    const ly = selectedLayer.y;
    const rx = lx + selectedLayer.width;
    const by = ly + selectedLayer.height;

    let x1 = Math.max(lx, Math.min(box.x, rx));
    let y1 = Math.max(ly, Math.min(box.y, by));
    let x2 = Math.max(lx, Math.min(box.x + box.w, rx));
    let y2 = Math.max(ly, Math.min(box.y + box.h, by));

    const cx = x1 - lx;
    const cy = y1 - ly;
    const cw = Math.max(1, x2 - x1);
    const ch = Math.max(1, y2 - y1);

    return { x: Math.round(cx), y: Math.round(cy), w: Math.round(cw), h: Math.round(ch) };
  }, [transformState, selectedLayer]);

  // Styles
  const styles = useMemo(() => {
    return {
      root: {
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        width: "100%",
        maxWidth: 1200,
        margin: "0 auto",
        padding: "16px",
      },
      toolbar: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: theme.surface,
        border: theme.border,
        borderRadius: theme.radius,
        boxShadow: theme.shadow,
        padding: "12px 16px",
      },
      leftGroup: {
        display: "flex",
        gap: "8px",
        alignItems: "center",
      },
      rightGroup: {
        display: "flex",
        gap: "8px",
        alignItems: "center",
      },
      uploadLabel: {
        background: theme.primary,
        color: "#fff",
        border: "none",
        borderRadius: "10px",
        padding: "10px 14px",
        cursor: "pointer",
        fontWeight: 600,
        transition: "transform 0.15s ease, box-shadow 0.2s ease",
        boxShadow: "0 6px 14px rgba(37, 99, 235, 0.25)",
      },
      clearBtn: {
        background: theme.secondary,
        color: "#111827",
        border: "none",
        borderRadius: "10px",
        padding: "10px 14px",
        cursor: "pointer",
        fontWeight: 600,
        transition: "transform 0.15s ease, box-shadow 0.2s ease",
        boxShadow: "0 6px 14px rgba(245, 158, 11, 0.25)",
      },
      hint: {
        color: theme.text,
        opacity: 0.7,
        fontSize: 14,
      },
      workspaceWrapper: {
        background: theme.surface,
        border: theme.border,
        borderRadius: theme.radius,
        boxShadow: theme.shadow,
        padding: "12px",
      },
      workspace: {
        position: "relative",
        width: "100%",
        minHeight: "420px",
        height: "60vh",
        maxHeight: "700px",
        background: `linear-gradient(180deg, rgba(37, 99, 235, 0.05) 0%, rgba(249, 250, 251, 0.6) 100%)`,
        borderRadius: theme.radius,
        overflow: "hidden",
        outline: "2px dashed rgba(37, 99, 235, 0.25)",
        outlineOffset: "-8px",
      },
      dropOverlay: {
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      },
      imgLayer: (selected, rotation) => ({
        position: "absolute",
        cursor: "grab",
        userSelect: "none",
        touchAction: "none",
        boxShadow: selected ? "0 6px 16px rgba(37, 99, 235, 0.35)" : "0 4px 12px rgba(17, 24, 39, 0.15)",
        outline: selected ? "3px solid rgba(37, 99, 235, 0.65)" : "none",
        borderRadius: "8px",
        transition: "box-shadow 0.12s ease",
        transform: `rotate(${rotation || 0}deg)`,
        transformOrigin: "center center",
      }),
      header: {
        color: theme.text,
        fontSize: 18,
        fontWeight: 700,
      },
      // Transform controls
      handle: (cursor) => ({
        position: "absolute",
        width: 10,
        height: 10,
        background: "#fff",
        border: "2px solid " + theme.primary,
        borderRadius: 4,
        boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
        cursor,
      }),
      rotateHandle: {
        position: "absolute",
        width: 12,
        height: 12,
        background: theme.primary,
        border: "2px solid #fff",
        borderRadius: 12,
        boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
        cursor: "grab",
      },
      angleBubble: {
        position: "absolute",
        transform: "translate(-50%, -100%)",
        background: theme.primary,
        color: "#fff",
        padding: "2px 6px",
        borderRadius: 8,
        fontSize: 12,
        boxShadow: theme.shadow,
        whiteSpace: "nowrap",
      },
      controlBtn: {
        background: theme.primary,
        color: "#fff",
        border: "none",
        borderRadius: 8,
        padding: "6px 10px",
        fontSize: 12,
        cursor: "pointer",
        boxShadow: "0 4px 12px rgba(37,99,235,0.25)",
      },
      controlBtnGhost: {
        background: "#ffffff",
        color: theme.text,
        border: "1px solid rgba(17,24,39,0.1)",
        borderRadius: 8,
        padding: "6px 10px",
        fontSize: 12,
        cursor: "pointer",
        boxShadow: "0 4px 10px rgba(0,0,0,0.06)",
      },
      cropOverlay: {
        position: "absolute",
        inset: 0,
        background: "rgba(0,0,0,0.25)",
        pointerEvents: "none",
      },
      cropBox: {
        position: "absolute",
        border: "2px dashed " + theme.secondary,
        background: "rgba(245, 158, 11, 0.12)",
        pointerEvents: "none",
        borderRadius: 6,
      },
      cropActions: {
        position: "absolute",
        display: "flex",
        gap: 8,
        zIndex: 10,
      },
      toolRow: {
        display: "flex",
        gap: 8,
        alignItems: "center",
      },
      smallHint: {
        fontSize: 12,
        opacity: 0.7,
        color: theme.text,
      },
    };
  }, [theme]);

  // Helpers to position handles around the selected layer bounding box (ignores rotation for simplicity)
  const RenderTransformControls = ({ layer }) => {
    if (!layer?.isSelected) return null;
    const { x, y, width, height, rotation } = layer;
    const cx = x + width / 2;
    const top = y - 16;

    const handleProps = [
      { key: "nw", left: x - 5, top: y - 5, cursor: "nwse-resize" },
      { key: "n", left: cx - 5, top: y - 5, cursor: "ns-resize" },
      { key: "ne", left: x + width - 5, top: y - 5, cursor: "nesw-resize" },
      { key: "e", left: x + width - 5, top: y + height / 2 - 5, cursor: "ew-resize" },
      { key: "se", left: x + width - 5, top: y + height - 5, cursor: "nwse-resize" },
      { key: "s", left: cx - 5, top: y + height - 5, cursor: "ns-resize" },
      { key: "sw", left: x - 5, top: y + height - 5, cursor: "nesw-resize" },
      { key: "w", left: x - 5, top: y + height / 2 - 5, cursor: "ew-resize" },
    ];

    return (
      <>
        {/* Resize handles */}
        {handleProps.map((hp) => (
          <div
            key={hp.key}
            style={{ ...styles.handle(hp.cursor), left: hp.left, top: hp.top }}
            onPointerDown={(e) => startResize(e, layer.id, hp.key)}
            role="button"
            aria-label={`Resize ${hp.key}`}
          />
        ))}
        {/* Rotation handle and angle bubble */}
        <div
          style={{ ...styles.rotateHandle, left: cx - 6, top }}
          onPointerDown={(e) => startRotate(e, layer.id)}
          role="button"
          aria-label="Rotate"
          title="Rotate"
        />
        <div style={{ ...styles.angleBubble, left: cx, top: top - 8 }}>
          {Math.round(rotation || 0)}°
        </div>
        {/* Tool row: crop */}
        <div style={{ position: "absolute", left: x, top: y - 42, display: "flex", gap: 8 }}>
          <button style={styles.controlBtnGhost} onPointerDown={(e)=>beginCropDraw(e, layer.id)} aria-label="Start crop">
            Crop
          </button>
          <span style={styles.smallHint}>{keyModifiers.shift ? "Aspect locked" : "Hold Shift to lock aspect"}</span>
        </div>
      </>
    );
  };

  // Crop UI overlay (in-place with confirm/cancel)
  const RenderCropUI = () => {
    if (!transformState || transformState.type !== "crop" || !selectedLayer) return null;
    const rel = getCropBoxRelativeToLayer();
    if (!rel) return null;

    const lx = selectedLayer.x + rel.x;
    const ly = selectedLayer.y + rel.y;

    return (
      <>
        {/* Crop box in layer space */}
        <div
          style={{
            ...styles.cropBox,
            left: lx,
            top: ly,
            width: rel.w,
            height: rel.h,
          }}
        />
        {/* Darken outside (visual aid) */}
        <div style={styles.cropOverlay} />
        {/* Confirm / Cancel */}
        <div style={{ ...styles.cropActions, left: lx, top: Math.max(ly - 40, 4) }}>
          <button
            style={styles.controlBtn}
            onClick={() => {
              applyCrop(selectedLayer.id, rel);
              setTransformState(null);
            }}
            aria-label="Confirm crop"
          >
            Confirm
          </button>
          <button
            style={styles.controlBtnGhost}
            onClick={() => setTransformState(null)}
            aria-label="Cancel crop"
          >
            Cancel
          </button>
        </div>
      </>
    );
  };

  return (
    <div style={styles.root}>
      {/* Minimal toolbar */}
      <div style={styles.toolbar} role="toolbar" aria-label="Canvas toolbar">
        <div style={styles.leftGroup}>
          <span style={styles.header}>Workspace</span>
        </div>
        <div style={styles.rightGroup}>
          {/* Upload button */}
          <label htmlFor="image-uploader" style={styles.uploadLabel}>
            Upload Images
          </label>
          <input
            id="image-uploader"
            type="file"
            accept="image/png, image/jpeg"
            multiple
            onChange={onFileInputChange}
            style={{ display: "none" }}
            aria-label="Upload images"
          />
          {/* Clear button */}
          <button type="button" onClick={clearCanvas} style={styles.clearBtn} aria-label="Clear canvas">
            Clear Canvas
          </button>
        </div>
      </div>

      {/* Workspace area with drag-and-drop */}
      <div
        ref={containerRef}
        style={styles.workspaceWrapper}
        onDrop={onDrop}
        onDragOver={onDragOver}
      >
        <div
          style={styles.workspace}
          onPointerMove={onContainerPointerMove}
          onPointerUp={onContainerPointerUp}
          onPointerLeave={onContainerPointerUp}
          role="region"
          aria-label="Canvas workspace"
        >
          {/* Hint text */}
          {layers.length === 0 && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: theme.text,
                opacity: 0.6,
                fontSize: 16,
                textAlign: "center",
                padding: "0 24px",
              }}
            >
              <div>
                Drag & drop images here or use the Upload Images button
                <div style={{ marginTop: 8, ...styles.hint }}>
                  Supported formats: PNG, JPG, JPEG. Click and drag images to reposition them.
                </div>
              </div>
            </div>
          )}

          {/* Render image layers with transforms */}
          {layers.map((layer) => (
            <div
              key={layer.id}
              style={{
                position: "absolute",
                left: layer.x,
                top: layer.y,
                width: layer.width,
                height: layer.height,
                transform: `rotate(${layer.rotation || 0}deg)`,
                transformOrigin: "center center",
              }}
            >
              <img
                src={layer.src}
                alt={`layer-${layer.id}`}
                draggable={false}
                onPointerDown={(e) => onLayerPointerDown(e, layer.id)}
                style={{
                  ...styles.imgLayer(layer.isSelected, layer.rotation),
                  left: 0,
                  top: 0,
                  width: "100%",
                  height: "100%",
                }}
              />
              {/* Render controls above the element, ignoring rotation for simplicity so handles align to bounding box */}
            </div>
          ))}

          {/* Overlay controls rendered atop all */}
          {selectedLayer && <RenderTransformControls layer={selectedLayer} />}

          {/* Crop UI */}
          <RenderCropUI />

          {/* Invisible overlay to capture drops */}
          <div style={styles.dropOverlay} aria-hidden="true" />
        </div>
      </div>

      {/* Usage note */}
      <div
        style={{
          color: theme.text,
          opacity: 0.75,
          fontSize: 13,
          textAlign: "center",
        }}
      >
        Tip: Upload one or more images, then click an image to select and drag it around.
        Use handles to resize (hold Shift to lock aspect), top circle to rotate (angle shows while rotating),
        and Crop to cut a region. Press Esc to cancel active transforms.
      </div>
    </div>
  );
}

export default CanvasWorkspace;
