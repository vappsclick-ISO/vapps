import Image from 'next/image'
import React from 'react'

const Welcome = () => {
  return (
    <>
      <section className="welcome-screen bg-[url('/images/auth-bg.png')] bg-cover bg-no-repeat">
        <div className="container mx-auto px-5">
          <div className="inner flex flex-col items-center justify-center h-screen">
            <Image src="/images/logo.png" alt="Vercel Logo" width={400} height={223} />
            <h3 className='mt-8 mb-3 font-bold text-2xl text-center text-[#505050]'>Welcome to VieTech VApps</h3>
            <p className='text-lg text-center text-[#787878]'>Let's set up your organization in a few easy steps</p>
          </div>
        </div>
      </section>
    </>
  )
}

export default Welcome