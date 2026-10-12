import { RefObject, useEffect } from 'react';
import { useLocation } from 'react-router-dom'

const ScrollToTop = ({children, containerRef}: {children?: React.ReactNode, containerRef?: RefObject<HTMLDivElement | null>;}) => {
    const {pathname} = useLocation();

    useEffect(() =>{
      if(containerRef?.current){
        containerRef.current.scrollTo(0, 0);
      }

        window.scrollTo(0, 0);
    }, [pathname, containerRef])

  return (
    <>
        {children}
    </>
  )
}

export default ScrollToTop