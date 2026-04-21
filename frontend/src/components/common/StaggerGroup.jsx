import { Children } from 'react'
import { motion } from 'framer-motion'

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
  },
}

/**
 * 자식을 각 motion.div 로 감싸 순차 페이드인.
 * 레이아웃에 영향 주지 않도록 wrapper div 는 flex/grid 특성이 없어야 하는 자리에서만 사용.
 * space-y-* 같은 Tailwind 유틸은 그대로 className 에 넘겨 유지.
 */
export default function StaggerGroup({ children, className, style }) {
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
