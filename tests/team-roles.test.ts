import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  ROLES,
  Role,
  can,
  canManage,
  assignableRoles,
  lastOwnerProblem,
  initials,
  isRole,
  homeFor,
} from '../lib/team/roles'

describe('can — what each role may do', () => {
  test('viewers can look but not post', () => {
    assert.equal(can('viewer', 'view'), true)
    assert.equal(can('viewer', 'post'), false)
    assert.equal(can('viewer', 'edit_styles'), false)
    assert.equal(can('viewer', 'view_admin'), false)
  })

  test('editors post and edit styles but stay out of admin', () => {
    assert.equal(can('editor', 'post'), true)
    assert.equal(can('editor', 'edit_styles'), true)
    assert.equal(can('editor', 'manage_accounts'), false)
    assert.equal(can('editor', 'view_admin'), false)
    assert.equal(can('editor', 'manage_team'), false)
  })

  test('admins and owners can do everything', () => {
    for (const role of ['admin', 'owner'] as Role[]) {
      for (const action of ['view', 'post', 'edit_styles', 'manage_accounts', 'view_admin', 'manage_team'] as const) {
        assert.equal(can(role, action), true, `${role} ${action}`)
      }
    }
  })

  test('a higher role never loses a permission a lower one has', () => {
    const order: Role[] = ['viewer', 'editor', 'admin', 'owner']
    for (const action of ['view', 'post', 'edit_styles', 'manage_accounts', 'view_admin', 'manage_team'] as const) {
      for (let i = 1; i < order.length; i++) {
        if (can(order[i - 1], action)) assert.equal(can(order[i], action), true)
      }
    }
  })
})

describe('canManage — who may change whom', () => {
  test('owners may change anyone to anything', () => {
    for (const target of ROLES) for (const next of ROLES) assert.equal(canManage('owner', target, next), true)
  })

  test('admins manage everyone below owner', () => {
    assert.equal(canManage('admin', 'editor', 'admin'), true)
    assert.equal(canManage('admin', 'admin', 'viewer'), true)
    assert.equal(canManage('admin', 'viewer'), true)
  })

  test('admins can neither touch an owner nor create one', () => {
    assert.equal(canManage('admin', 'owner'), false)
    assert.equal(canManage('admin', 'owner', 'viewer'), false)
    assert.equal(canManage('admin', 'editor', 'owner'), false)
  })

  test('editors and viewers manage nobody', () => {
    for (const actor of ['editor', 'viewer'] as Role[]) {
      for (const target of ROLES) assert.equal(canManage(actor, target), false)
    }
  })

  test('assignableRoles matches canManage', () => {
    assert.deepEqual(assignableRoles('owner'), ['owner', 'admin', 'editor', 'viewer'])
    assert.deepEqual(assignableRoles('admin'), ['admin', 'editor', 'viewer'])
    assert.deepEqual(assignableRoles('editor'), [])
  })
})

describe('lastOwnerProblem — never strand the workspace', () => {
  const solo = [
    { id: 'o1', role: 'owner' as Role, status: 'active' as const },
    { id: 'e1', role: 'editor' as Role, status: 'active' as const },
  ]

  test('blocks removing, demoting or suspending the only owner', () => {
    assert.ok(lastOwnerProblem(solo, 'o1', { kind: 'remove' }))
    assert.ok(lastOwnerProblem(solo, 'o1', { kind: 'role', role: 'admin' }))
    assert.ok(lastOwnerProblem(solo, 'o1', { kind: 'status', status: 'suspended' }))
  })

  test('allows it when another active owner remains', () => {
    const two = [...solo, { id: 'o2', role: 'owner' as Role, status: 'active' as const }]
    assert.equal(lastOwnerProblem(two, 'o1', { kind: 'remove' }), null)
  })

  test('a suspended second owner does not count', () => {
    const two = [...solo, { id: 'o2', role: 'owner' as Role, status: 'suspended' as const }]
    assert.ok(lastOwnerProblem(two, 'o1', { kind: 'remove' }))
  })

  test('changes that keep the owner are fine', () => {
    assert.equal(lastOwnerProblem(solo, 'o1', { kind: 'role', role: 'owner' }), null)
    assert.equal(lastOwnerProblem(solo, 'o1', { kind: 'status', status: 'active' }), null)
    assert.equal(lastOwnerProblem(solo, 'e1', { kind: 'remove' }), null)
  })
})

describe('helpers', () => {
  test('initials', () => {
    assert.equal(initials('Ada Lovelace'), 'AL')
    assert.equal(initials('  grace  brewster murray hopper '), 'GH')
    assert.equal(initials('cher'), 'CH')
    assert.equal(initials('   '), '?')
  })

  test('isRole rejects anything not in the list', () => {
    assert.equal(isRole('admin'), true)
    assert.equal(isRole('superuser'), false)
    assert.equal(isRole(3), false)
  })
})

describe('homeFor — where each role lands', () => {
  test('owners and admins land on the admin site, everyone else on the user site', () => {
    assert.equal(homeFor('owner'), '/admin')
    assert.equal(homeFor('admin'), '/admin')
    assert.equal(homeFor('editor'), '/dashboard')
    assert.equal(homeFor('viewer'), '/dashboard')
  })
})
