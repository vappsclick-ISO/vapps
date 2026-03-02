import React from 'react'
import Image from 'next/image'

const Header = () => {
  return (
    <>
      <header>
        <div className="container mx-auto px-5">
          <div className="inner flex items-center flex-col py-4">
            <Image src="/images/logo.png" alt="Vercel Logo" width={150} height={64} />
            <h3 className='text-lg'>Welcome to VieTech VApps</h3>
            <p className='text-'>Get started by creating organizations or joining a workspace or process</p>
          </div>
        </div>
      </header>
    </>
  )
}

export default Header