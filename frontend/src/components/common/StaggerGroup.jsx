import { Children } from 'react'
import { motion } from 'framer-motion'

/**
 * 자식을 각 motion.div 로 감싸 순차 페이드인.
 * translateY 대신 scale 을 쓰는 이유: Chrome 이 translateY 애니메이션을
 * 레이아웃 변경(CLS)으로 카운트하는 케이스가 있어서. scale 은 compositor-only 라 CLS 0.
 *
 * @param {number} staggerDelay - 자식 간 간격 (초)
 * @param {number} scaleFrom - 시작 scale (기본 0.97)
 * @param {number} duration - 각 자식 애니메이션 지속시간 (초)
 */
export default function StaggerGroup({
  children,
  className,
  style,
  staggerDelay = 0.08,
  scaleFrom = 0.97,
  duration = 0.35,
}) {
  const containerVariants = {
    hidden: {},
    show: { transition: { staggerChildren: staggerDelay } },
  }

  const itemVariants = {
    hidden: { opacity: 0, scale: scaleFrom },
    show: {
      opacity: 1,
      scale: 1,
      transition: { duration },
    },
  }

  return (
    <motion.div
      className={className}
      style={style}
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {Children.map(children, (child, i) => (
        child == null || child === false
          ? null
          : <motion.div variants={itemVariants} key={i} style={{ willChange: 'transform, opacity' }}>{child}</motion.div>
      ))}
    </motion.div>
  )
}
