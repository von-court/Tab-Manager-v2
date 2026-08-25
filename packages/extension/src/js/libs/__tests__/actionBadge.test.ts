// Transient badge feedback for archives triggered outside the popup
// (spec: tab-archiving — feedback for archives triggered outside the popup).

const mockActionSetBadgeText = jest.fn()
const mockActionSetBadgeBackgroundColor = jest.fn()

jest.mock('libs', () => ({
  browser: {
    action: {
      setBadgeText: mockActionSetBadgeText,
      setBadgeBackgroundColor: mockActionSetBadgeBackgroundColor,
    },
    browserAction: undefined,
  },
}))

import {
  BADGE_FLASH_MS,
  clearActionBadge,
  flashActionBadge,
} from 'libs/actionBadge'

describe('actionBadge', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    mockActionSetBadgeText.mockClear()
    mockActionSetBadgeBackgroundColor.mockClear()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('shows a success indicator and clears it after the flash', () => {
    flashActionBadge(true)

    expect(mockActionSetBadgeBackgroundColor).toHaveBeenCalledTimes(1)
    expect(mockActionSetBadgeText).toHaveBeenCalledTimes(1)
    const [{ text }] = mockActionSetBadgeText.mock.calls[0]
    expect(text).not.toBe('')

    jest.advanceTimersByTime(BADGE_FLASH_MS)

    expect(mockActionSetBadgeText).toHaveBeenLastCalledWith({ text: '' })
  })

  it('distinguishes failure from success', () => {
    flashActionBadge(true)
    const success = mockActionSetBadgeText.mock.calls[0][0].text
    const successColor =
      mockActionSetBadgeBackgroundColor.mock.calls[0][0].color

    mockActionSetBadgeText.mockClear()
    mockActionSetBadgeBackgroundColor.mockClear()
    flashActionBadge(false)

    expect(mockActionSetBadgeText.mock.calls[0][0].text).not.toBe(success)
    expect(mockActionSetBadgeBackgroundColor.mock.calls[0][0].color).not.toBe(
      successColor,
    )
  })

  it('clears the badge on demand', () => {
    clearActionBadge()

    expect(mockActionSetBadgeText).toHaveBeenCalledWith({ text: '' })
  })

  it('tolerates a missing action API', () => {
    expect(() => flashActionBadge(true)).not.toThrow()
  })
})
