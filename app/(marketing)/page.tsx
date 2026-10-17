import { SpaceScene } from '@/components/landing/scene/SpaceScene'
import { HeroSection } from '@/components/landing/sections/HeroSection'
import { ConstellationSection } from '@/components/landing/sections/ConstellationSection'
import { InterludeSection } from '@/components/landing/sections/InterludeSection'
import { EightThingsSection } from '@/components/landing/sections/EightThingsSection'
import { HowItWorksSection } from '@/components/landing/sections/HowItWorksSection'
import { OfferSection } from '@/components/landing/sections/OfferSection'
import { CloseSection } from '@/components/landing/sections/CloseSection'

/**
 * Landing page — the sections in reading order.
 *
 * One idea, carried by the sky: your post is a single star (Hero), and Post
 * Bridge turns it into a constellation of platforms (Constellation). The
 * scene moves that star down the page as you scroll and flies the camera
 * through the stars between sections.
 *
 *   components/landing/content.ts      every word and number
 *   components/landing/sections/*.tsx  one file per section
 *   components/landing/scene/          the animated sky (one client island)
 *
 * Still a server component and still static: the scene reads data-* hooks
 * from the sections rather than owning the layout.
 */
export default function Home() {
  return (
    <div className="space-page relative">
      <SpaceScene />
      <HeroSection />
      <ConstellationSection />
      <InterludeSection />
      <EightThingsSection />
      <HowItWorksSection />
      <OfferSection />
      <CloseSection />
    </div>
  )
}
