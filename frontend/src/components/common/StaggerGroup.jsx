import { Children } from 'react'
import { motion } from 'framer-motion'

/**
 * 자식을 각 motion.div 로 감싸 순차 페이드인.
 * 기본값은 프로미스나인 사이트와 동일 (y 30, duration 0.4, 간격 0.1s).
 *
 * @param {number} staggerDelay - 자식 간 간격 (초)
 * @param {number} yOffset - 시작 y 오프셋 (px)
 * @param {number} duration - 각 자식 애니메이션 지속시간 (초)
 */
export default function StaggerGroup({
  children,
  className,
  style,
  staggerDelay = 0.1,
  yOffset = 30,
  duration = 0.4,
}) {
  const containerVariants = {
    hidden: {},
    show: { transition: { staggerChildren: staggerDelay } },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: yOffset },
    show: {
      opacity: 1,
      y: 0,
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
          : <motion.div variants={itemVariants} key={i}>{child}</motion.div>
      ))}
    </motion.div>
  )
}
