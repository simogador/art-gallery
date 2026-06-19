'use client'

export default function HomePage() {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%)',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        maxWidth: '600px',
        background: 'white',
        borderRadius: '10px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)',
        padding: '60px 40px',
        textAlign: 'center',
      }}>
        <div style={{
          width: '80px',
          height: '80px',
          margin: '0 auto 30px',
          background: 'linear-gradient(135deg, #c4a74a 0%, #8b6f47 100%)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '40px',
          fontWeight: 'bold',
        }}>E</div>
        
        <h1 style={{ color: '#2c2c2c', fontSize: '2.5em', marginBottom: '15px' }}>Errancy</h1>
        <p style={{ color: '#8b8b8b', fontSize: '1.1em', marginBottom: '10px' }}>Galerie d'art contemporain</p>
        
        <div style={{
          width: '60px',
          height: '2px',
          background: 'linear-gradient(90deg, transparent, #c4a74a, transparent)',
          margin: '30px auto',
        }} />
        
        <p style={{ color: '#555', fontSize: '0.95em', lineHeight: 1.8, marginBottom: '40px' }}>
          Notre galerie est actuellement en développement. Nous préparons une expérience exceptionnelle pour vous présenter une sélection unique d'œuvres d'art contemporain.
        </p>

        <p style={{ color: '#999', fontSize: '0.9em', marginBottom: '30px' }}>
          ✨ Lancement très bientôt ✨
        </p>

        <div style={{ marginBottom: '30px' }}>
          <p style={{ color: '#2c2c2c', marginBottom: '15px', fontWeight: 600 }}>
            Soyez informé du lancement
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <input 
              type="email" 
              placeholder="Votre email" 
              style={{
                minWidth: '200px',
                padding: '12px 16px',
                border: '2px solid #e0e0e0',
                borderRadius: '5px',
                fontSize: '0.95em',
              }}
            />
            <button 
              style={{
                padding: '12px 30px',
                background: 'linear-gradient(135deg, #c4a74a 0%, #8b6f47 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                fontSize: '0.95em',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Me notifier
            </button>
          </div>
        </div>

        <div style={{ marginTop: '40px', paddingTop: '30px', borderTop: '1px solid #e0e0e0' }}>
          <p style={{ color: '#8b8b8b', fontSize: '0.9em', marginBottom: '15px' }}>Suivez-nous</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px' }}>
            <a href="https://instagram.com">📷</a>
            <a href="https://facebook.com">f</a>
            <a href="https://twitter.com">𝕏</a>
          </div>
        </div>

        <div style={{ marginTop: '30px', color: '#c4a74a', fontSize: '0.85em' }}>
          En développement
        </div>
      </div>
    </div>
  )
}
