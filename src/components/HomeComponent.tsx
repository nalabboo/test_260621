"use client";

import React, { useState, useEffect, useRef } from "react";

export default function HomeComponent() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0, rawX: -100, rawY: -100 });
  
  // 배경음악(BGM) 상태 관리
  const [bgm, setBgm] = useState<HTMLAudioElement | null>(null);
  
  // 무한 스크롤을 위해 맵 제한을 해제합니다. 카메라는 항상 캐릭터를 중앙에 포커스합니다.
  const MAX_WORLD_X = 9999999;

  // 게임 좌표계 상태
  const [charWorldX, setCharWorldX] = useState(0); // 캐릭터의 실제 월드(맵) 좌표
  const [cameraX, setCameraX] = useState(0);       // 카메라가 비추는 맵의 위치
  
  // 걷기 애니메이션 상태
  const [isMoving, setIsMoving] = useState(false);
  const [walkFrame, setWalkFrame] = useState(1); // 1 or 2
  
  // 부드러운 이동(rAF)을 위한 Ref
  const charWorldXRef = useRef(0);
  const targetWorldXRef = useRef(0);
  const isMovingRef = useRef(false);

  useEffect(() => {
    let rafId: number;
    
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setMousePos({ x, y, rawX: e.clientX, rawY: e.clientY });
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  // requestAnimationFrame을 이용한 고정 속도 프레임 이동 로직 (클릭 연타 시에도 끊김 없음)
  useEffect(() => {
    let rafId: number;
    const speed = 3.5; // 프레임당 이동 픽셀 (원하시는 걷기 속도에 맞춰 조절 가능)

    const loop = () => {
      let current = charWorldXRef.current;
      const target = targetWorldXRef.current;
      const diff = target - current;

      if (Math.abs(diff) > 0.5) {
        // 목표까지 도달하지 않음 (이동 중)
        if (!isMovingRef.current) {
          isMovingRef.current = true;
          setIsMoving(true);
        }
        
        if (Math.abs(diff) <= speed) {
          current = target;
        } else {
          current += Math.sign(diff) * speed;
        }
        
        charWorldXRef.current = current;
        setCharWorldX(current);
        setCameraX(current);
      } else {
        // 목표 도달 (정지)
        if (isMovingRef.current) {
          isMovingRef.current = false;
          setIsMoving(false);
        }
      }
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // 걷는 동안 프레임 전환 (200ms 간격)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isMoving) {
      interval = setInterval(() => {
        setWalkFrame((prev) => (prev === 1 ? 2 : 1));
      }, 200);
    } else {
      setWalkFrame(1); // 멈추면 기본(c1)으로 복귀
    }
    return () => clearInterval(interval);
  }, [isMoving]);

  // 9번부터 1번까지 순서대로 배경 레이어 생성 (새로운 b 시리즈 이미지)
  const bgImages = Array.from({ length: 9 }, (_, i) => {
    const num = 9 - i;
    return { id: `b${num}`, src: `/img/b${num}.png`, depth: 10 - num, isChar: false };
  });

  // b5와 b4 사이에 캐릭터 이미지 삽입
  const layers: { id: string; src: string; depth: number; isChar?: boolean; isHidden?: boolean }[] = [];
  for (const bg of bgImages) {
    if (bg.id === 'b4') {
      // b4 바로 뒤(원근감 상 더 뒤쪽)에 b8 이미지를 추가로 삽입
      layers.push({ id: 'b8_extra', src: `/img/b8.png`, depth: 5.8, isChar: false });
    }
    layers.push(bg);
    if (bg.id === 'b5') {
      // 브라우저 렌더링 깜빡임을 방지하기 위해 두 이미지를 모두 DOM에 올리고 투명도(opacity)로만 교체합니다.
      layers.push({ id: 'char1', src: `/img/ch1.png`, depth: 5.9, isChar: true, isHidden: walkFrame !== 1 });
      layers.push({ id: 'char2', src: `/img/ch2.png`, depth: 5.9, isChar: true, isHidden: walkFrame !== 2 });
    }
  }

  // 화면 클릭 시 캐릭터 및 카메라 이동 목표 설정
  const handleContainerClick = (e: React.MouseEvent) => {
    // 화면 클릭 좌표를 바탕으로 맵(월드) 상의 목표 좌표 계산
    const clickScreenX = e.clientX - window.innerWidth / 2;
    let targetWorldX = charWorldXRef.current + clickScreenX;

    // 맵 끝을 넘어가지 않도록 캐릭터 이동 제한
    targetWorldX = Math.max(0, Math.min(MAX_WORLD_X, targetWorldX));

    // 목표 좌표만 업데이트해주면 rAF 루프가 부드럽게 알아서 끌고 감
    targetWorldXRef.current = targetWorldX;
  };

  return (
    <div 
      className="relative min-h-screen w-full overflow-hidden bg-[#e8f1ec] cursor-none"
      onClick={handleContainerClick}
    >
      {layers.map((layer) => {
        // 깊이(depth)에 따라 이동 반경을 다르게 주어 마우스 패럴랙스 형성
        const moveX = mousePos.x * layer.depth * 4; 
        const moveY = mousePos.y * layer.depth * 4;
        
        // 카메라가 캐릭터에 초점을 맞추도록, 캐릭터(depth 5.9) 기준 원근감에 따른 아웃포커싱(DoF) 효과 적용
        const depthDiff = Math.abs(layer.depth - 5.9);
        const blurAmount = layer.isChar ? 0 : (depthDiff > 1.5 ? (depthDiff - 1.5) * 1.5 : 0);

        const bgSizeClass = layer.isChar ? "" : "bg-cover";
        const bgPosClass = layer.isChar ? "" : "bg-left";
        const bgRepeatClass = layer.isChar ? "bg-no-repeat" : "bg-repeat-x";

        // 배경 스크롤 속도 비율 (원근감을 유지하되 전체적으로 배경이 흐르는 속도를 절반으로 늦춤)
        const scrollRate = (layer.depth / 5.9) * 0.5;

        // b9 앞쪽에 있는 원본 b8 이미지만 살짝 위로 올려줍니다.
        const extraTranslateY = layer.id === 'b8' ? '-5vh' : '0px';

        return (
          <div
            key={layer.id}
            className={`absolute inset-0 pointer-events-none transition-opacity duration-75`}
            style={{
              zIndex: Math.floor(layer.depth * 10),
              opacity: layer.isHidden ? 0 : 1,
              // [카메라 래퍼]: 카메라는 캐릭터와 반대 방향(-cameraX)으로 이동
              transform: layer.isChar ? `translate3d(${-cameraX}px, 0px, 0px)` : 'none'
            }}
          >
            <div
              className="absolute inset-0 w-full h-full"
              style={{
                // [월드 래퍼]: 캐릭터 자체의 월드 이동(+charWorldX)
                transform: layer.isChar ? `translate3d(${charWorldX}px, 0px, 0px)` : 'none'
              }}
            >
              <div
                className={`absolute inset-0 ${bgSizeClass} ${bgPosClass} ${bgRepeatClass} w-full h-full ease-out will-change-transform`}
                style={{ 
                  backgroundImage: `url('${layer.src}')`, 
                  backgroundSize: layer.isChar ? "auto 35%" : undefined,
                  // 배경은 rAF 루프에 의해 매 프레임 업데이트되므로 CSS transition을 제외하여 뚝뚝 끊기지 않게 함
                  backgroundPosition: layer.isChar 
                    ? "center 70%" 
                    : `calc(0% - ${cameraX * scrollRate}px) center`,
                  // 마우스 패럴랙스 효과(transform)만 CSS transition으로 부드럽게 처리
                  transform: `translate3d(${moveX}px, calc(${moveY}px + ${extraTranslateY}), 0) scale(1.1)`,
                  transition: "transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                  filter: layer.isChar 
                    ? `drop-shadow(0px 12px 12px rgba(0,0,0,0.4))` 
                    : (blurAmount > 0 ? `blur(${blurAmount}px)` : 'none')
                }}
              />
            </div>
          </div>
        );
      })}

      {/* 마우스 커서 (하얀 동그라미 + 글래스모피즘) */}
      <div 
        className="fixed top-0 left-0 w-10 h-10 rounded-full pointer-events-none z-[100] backdrop-blur-md bg-white/20 border border-white/40 shadow-[0_0_20px_rgba(255,255,255,0.3)] flex items-center justify-center transition-transform duration-75 ease-out will-change-transform"
        style={{
          transform: `translate3d(${mousePos.rawX - 20}px, ${mousePos.rawY - 20}px, 0)`
        }}
      >
        <div className="w-1.5 h-1.5 bg-white rounded-full opacity-80" />
      </div>
    </div>
  );
}
